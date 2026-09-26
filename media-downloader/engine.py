from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable


SUPPORTED_URL_SCHEMES = ("http://", "https://")
PROGRESS_PATTERN = re.compile(r"\[download\]\s+(?P<percent>[\d.]+)%")
SPEED_PATTERN = re.compile(r"\bat\s+(?P<speed>\S+)")
ETA_PATTERN = re.compile(r"\bETA\s+(?P<eta>\S+)")


class DownloaderError(RuntimeError):
    pass


@dataclass(frozen=True)
class MediaInfo:
    title: str
    uploader: str
    duration: int | None
    thumbnail: str
    webpage_url: str


@dataclass(frozen=True)
class DownloadOptions:
    mode: str
    video_quality: str = "1080"
    audio_format: str = "mp3"
    audio_quality: str = "0"
    embed_thumbnail: bool = True
    embed_metadata: bool = True


def app_directory() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def resource_directory() -> Path:
    bundle = getattr(sys, "_MEIPASS", None)
    return Path(bundle) if bundle else app_directory()


def validate_url(value: str) -> str:
    url = value.strip()
    if not url.lower().startswith(SUPPORTED_URL_SCHEMES):
        raise ValueError("http:// 또는 https://로 시작하는 링크를 입력하세요.")
    if any(character in url for character in "\r\n\0"):
        raise ValueError("올바르지 않은 링크입니다.")
    return url


def find_binary(name: str) -> str:
    executable = f"{name}.exe" if os.name == "nt" else name
    candidates = [
        app_directory() / "bin" / executable,
        resource_directory() / "bin" / executable,
        app_directory() / executable,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    located = shutil.which(name)
    if located:
        return located
    raise DownloaderError(f"필수 구성 요소를 찾을 수 없습니다: {name}")


def base_command() -> list[str]:
    command = [find_binary("yt-dlp"), "--ignore-config", "--newline", "--no-playlist"]
    try:
        command.extend(["--ffmpeg-location", str(Path(find_binary("ffmpeg")).parent)])
    except DownloaderError:
        pass
    try:
        command.extend(["--js-runtimes", f"deno:{find_binary('deno')}"])
        command.extend(["--remote-components", "ejs:github"])
    except DownloaderError:
        pass
    return command


def build_info_command(url: str) -> list[str]:
    return [*base_command(), "--dump-single-json", "--skip-download", validate_url(url)]


def build_download_command(url: str, destination: Path, options: DownloadOptions) -> list[str]:
    clean_url = validate_url(url)
    destination.mkdir(parents=True, exist_ok=True)
    output = str(destination / "%(title).180B [%(id)s].%(ext)s")
    command = [*base_command(), "--progress", "--output", output]

    if options.mode == "audio":
        if options.audio_format not in {"mp3", "m4a", "opus", "wav", "flac"}:
            raise ValueError("지원하지 않는 오디오 형식입니다.")
        command.extend([
            "--extract-audio",
            "--audio-format", options.audio_format,
            "--audio-quality", options.audio_quality,
            "--format", "bestaudio/best",
        ])
    elif options.mode == "video":
        if options.video_quality not in {"2160", "1440", "1080", "720", "480", "360"}:
            raise ValueError("지원하지 않는 영상 화질입니다.")
        height = options.video_quality
        command.extend([
            "--format",
            f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best",
            "--merge-output-format", "mp4",
        ])
    else:
        raise ValueError("다운로드 종류는 video 또는 audio여야 합니다.")

    if options.embed_metadata:
        command.append("--embed-metadata")
    if options.embed_thumbnail:
        command.extend(["--embed-thumbnail", "--convert-thumbnails", "jpg"])
    command.append(clean_url)
    return command


def read_media_info(url: str, timeout: int = 45) -> MediaInfo:
    result = subprocess.run(
        build_info_command(url), capture_output=True, text=True, encoding="utf-8",
        errors="replace", timeout=timeout, creationflags=_creation_flags(),
    )
    if result.returncode != 0:
        raise DownloaderError(_friendly_error(result.stderr))
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise DownloaderError("미디어 정보를 읽지 못했습니다.") from error
    return MediaInfo(
        title=data.get("title") or "제목 없음",
        uploader=data.get("uploader") or data.get("channel") or "",
        duration=data.get("duration"),
        thumbnail=data.get("thumbnail") or "",
        webpage_url=data.get("webpage_url") or validate_url(url),
    )


def stream_download(
    command: Iterable[str], on_line: Callable[[str], None],
) -> subprocess.Popen[str]:
    process = subprocess.Popen(
        list(command), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
        creationflags=_creation_flags(),
    )
    assert process.stdout is not None
    for line in process.stdout:
        on_line(line.rstrip())
    return process


def parse_progress(line: str) -> tuple[float, str] | None:
    match = PROGRESS_PATTERN.search(line)
    if not match:
        return None
    percent = min(100.0, max(0.0, float(match.group("percent"))))
    speed = SPEED_PATTERN.search(line)
    eta = ETA_PATTERN.search(line)
    details = " · ".join(part for part in (
        speed.group("speed") if speed else "",
        f"남은 시간 {eta.group('eta')}" if eta else "",
    ) if part)
    return percent, details


def _friendly_error(message: str) -> str:
    lowered = message.lower()
    if "sign in to confirm" in lowered or "not a bot" in lowered:
        return "서비스에서 자동 요청을 차단했습니다. 잠시 후 다시 시도해 주세요."
    if "javascript runtime" in lowered or "challenge solving" in lowered:
        return "YouTube 분석 구성 요소(Deno/EJS)를 확인하거나 업데이트해 주세요."
    if "unsupported url" in lowered:
        return "현재 지원하지 않는 링크입니다."
    lines = [line.strip() for line in message.splitlines() if line.strip()]
    return lines[-1] if lines else "다운로드 중 알 수 없는 오류가 발생했습니다."


def _creation_flags() -> int:
    return subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
