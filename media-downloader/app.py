from __future__ import annotations

import queue
import subprocess
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

from engine import (
    DownloadOptions,
    DownloaderError,
    build_download_command,
    parse_progress,
    read_media_info,
    stream_download,
)


ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")


class MediaDownloader(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        self.title("My Media Downloader")
        self.geometry("780x650")
        self.minsize(700, 590)
        self.download_directory = Path.home() / "Downloads"
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self.process: subprocess.Popen[str] | None = None
        self.last_output = ""
        self.mode = tk.StringVar(value="video")
        self.status_text = tk.StringVar(value="링크를 입력해 주세요")
        self.destination_text = tk.StringVar(value=str(self.download_directory))
        self._build_ui()
        self.after(100, self._drain_events)

    def _build_ui(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(4, weight=1)

        heading = ctk.CTkFrame(self, fg_color="transparent")
        heading.grid(row=0, column=0, padx=34, pady=(30, 18), sticky="ew")
        ctk.CTkLabel(heading, text="MY MEDIA", font=ctk.CTkFont(size=13, weight="bold"),
                     text_color=("#6B7280", "#9CA3AF")).pack(anchor="w")
        ctk.CTkLabel(heading, text="링크에서 영상과 오디오를 저장하세요.",
                     font=ctk.CTkFont(size=28, weight="bold")).pack(anchor="w", pady=(5, 0))
        ctk.CTkLabel(heading, text="다운로드와 변환은 이 컴퓨터에서 처리됩니다.",
                     font=ctk.CTkFont(size=14), text_color=("#6B7280", "#9CA3AF")).pack(anchor="w", pady=(5, 0))

        link_frame = ctk.CTkFrame(self)
        link_frame.grid(row=1, column=0, padx=34, pady=8, sticky="ew")
        link_frame.grid_columnconfigure(0, weight=1)
        self.url_entry = ctk.CTkEntry(link_frame, height=48, placeholder_text="https://www.youtube.com/watch?v=...")
        self.url_entry.grid(row=0, column=0, padx=(16, 8), pady=16, sticky="ew")
        self.inspect_button = ctk.CTkButton(link_frame, text="링크 확인", width=110, height=48, command=self.inspect)
        self.inspect_button.grid(row=0, column=1, padx=(0, 16), pady=16)

        choices = ctk.CTkFrame(self)
        choices.grid(row=2, column=0, padx=34, pady=8, sticky="ew")
        choices.grid_columnconfigure((0, 1), weight=1)
        ctk.CTkLabel(choices, text="저장 형식", font=ctk.CTkFont(weight="bold")).grid(row=0, column=0, padx=18, pady=(15, 5), sticky="w")
        mode_frame = ctk.CTkFrame(choices, fg_color="transparent")
        mode_frame.grid(row=1, column=0, padx=14, pady=(0, 16), sticky="w")
        ctk.CTkRadioButton(mode_frame, text="영상", variable=self.mode, value="video", command=self._toggle_mode).pack(side="left", padx=5)
        ctk.CTkRadioButton(mode_frame, text="오디오", variable=self.mode, value="audio", command=self._toggle_mode).pack(side="left", padx=14)

        self.quality_frame = ctk.CTkFrame(choices, fg_color="transparent")
        self.quality_frame.grid(row=0, column=1, rowspan=2, padx=18, pady=14, sticky="e")
        self.quality_label = ctk.CTkLabel(self.quality_frame, text="최대 화질")
        self.quality_label.pack(side="left", padx=8)
        self.quality_menu = ctk.CTkOptionMenu(self.quality_frame, values=["1080p", "720p", "480p", "360p"], width=120)
        self.quality_menu.pack(side="left")

        destination = ctk.CTkFrame(self, fg_color="transparent")
        destination.grid(row=3, column=0, padx=34, pady=10, sticky="ew")
        destination.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(destination, textvariable=self.destination_text, anchor="w").grid(row=0, column=0, sticky="ew")
        ctk.CTkButton(destination, text="저장 위치", width=100, fg_color="transparent", border_width=1,
                      text_color=("#111827", "#F9FAFB"), command=self.choose_directory).grid(row=0, column=1, padx=(10, 0))

        info = ctk.CTkFrame(self)
        info.grid(row=4, column=0, padx=34, pady=8, sticky="nsew")
        info.grid_columnconfigure(0, weight=1)
        self.title_label = ctk.CTkLabel(info, text="링크를 확인하면 제목과 정보를 표시합니다.",
                                        anchor="w", justify="left", wraplength=660,
                                        font=ctk.CTkFont(size=18, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=18, pady=(18, 5), sticky="ew")
        self.detail_label = ctk.CTkLabel(info, text="", anchor="w", text_color=("#6B7280", "#9CA3AF"))
        self.detail_label.grid(row=1, column=0, padx=18, pady=(0, 10), sticky="ew")
        self.progress = ctk.CTkProgressBar(info)
        self.progress.set(0)
        self.progress.grid(row=2, column=0, padx=18, pady=(12, 6), sticky="ew")
        ctk.CTkLabel(info, textvariable=self.status_text, anchor="w").grid(row=3, column=0, padx=18, pady=(0, 18), sticky="ew")

        actions = ctk.CTkFrame(self, fg_color="transparent")
        actions.grid(row=5, column=0, padx=34, pady=(10, 28), sticky="ew")
        actions.grid_columnconfigure(0, weight=1)
        self.download_button = ctk.CTkButton(actions, text="다운로드", height=48, command=self.download)
        self.download_button.grid(row=0, column=0, sticky="ew")
        self.cancel_button = ctk.CTkButton(actions, text="취소", width=90, height=48, fg_color="#B91C1C",
                                           command=self.cancel)

    def _toggle_mode(self) -> None:
        if self.mode.get() == "video":
            self.quality_label.configure(text="최대 화질")
            self.quality_menu.configure(values=["1080p", "720p", "480p", "360p"])
            self.quality_menu.set("1080p")
        else:
            self.quality_label.configure(text="오디오 형식")
            self.quality_menu.configure(values=["MP3", "M4A", "OPUS", "WAV", "FLAC"])
            self.quality_menu.set("MP3")

    def choose_directory(self) -> None:
        selected = filedialog.askdirectory(initialdir=self.download_directory)
        if selected:
            self.download_directory = Path(selected)
            self.destination_text.set(selected)

    def inspect(self) -> None:
        url = self.url_entry.get()
        self._set_busy(True, "링크를 확인하고 있습니다…")
        threading.Thread(target=self._inspect_worker, args=(url,), daemon=True).start()

    def _inspect_worker(self, url: str) -> None:
        try:
            self.events.put(("info", read_media_info(url)))
        except Exception as error:
            self.events.put(("error", error))

    def download(self) -> None:
        value = self.quality_menu.get().lower().replace("p", "")
        options = DownloadOptions(
            mode=self.mode.get(),
            video_quality=value if self.mode.get() == "video" else "1080",
            audio_format=value if self.mode.get() == "audio" else "mp3",
        )
        try:
            command = build_download_command(self.url_entry.get(), self.download_directory, options)
        except Exception as error:
            messagebox.showerror("입력 확인", str(error))
            return
        self._set_busy(True, "다운로드를 준비하고 있습니다…")
        self.cancel_button.grid(row=0, column=1, padx=(10, 0))
        threading.Thread(target=self._download_worker, args=(command,), daemon=True).start()

    def _download_worker(self, command: list[str]) -> None:
        try:
            self.last_output = ""
            self.process = stream_download(command, self._queue_output)
            code = self.process.wait()
            self.events.put(("complete", code))
        except Exception as error:
            self.events.put(("error", error))
        finally:
            self.process = None

    def _queue_output(self, line: str) -> None:
        if line.strip():
            self.last_output = line.strip()
        self.events.put(("line", line))

    def cancel(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self.status_text.set("취소하는 중…")

    def _drain_events(self) -> None:
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "info":
                    info = payload
                    self.title_label.configure(text=info.title)
                    duration = f"{info.duration // 60}:{info.duration % 60:02d}" if info.duration else "시간 정보 없음"
                    self.detail_label.configure(text=" · ".join(part for part in (info.uploader, duration) if part))
                    self._set_busy(False, "다운로드 옵션을 선택하세요.")
                elif kind == "line":
                    line = str(payload)
                    progress = parse_progress(line)
                    if progress:
                        percent, details = progress
                        self.progress.set(percent / 100)
                        self.status_text.set(f"다운로드 중 {percent:.1f}%{(' · ' + details) if details else ''}")
                    elif line.startswith("[Merger]") or line.startswith("[ExtractAudio]"):
                        self.status_text.set("파일을 변환하고 있습니다…")
                elif kind == "complete":
                    if payload == 0:
                        self.progress.set(1)
                        self._set_busy(False, "완료되었습니다. 저장 폴더를 확인하세요.")
                    else:
                        self._set_busy(False, "다운로드에 실패했습니다.")
                        messagebox.showerror("다운로드 실패", self.last_output or "링크 또는 설정을 확인하세요.")
                    self.cancel_button.grid_forget()
                elif kind == "error":
                    self._set_busy(False, "오류가 발생했습니다.")
                    self.cancel_button.grid_forget()
                    messagebox.showerror("처리 실패", str(payload))
        except queue.Empty:
            pass
        self.after(100, self._drain_events)

    def _set_busy(self, busy: bool, message: str) -> None:
        state = "disabled" if busy else "normal"
        self.inspect_button.configure(state=state)
        self.download_button.configure(state=state)
        self.status_text.set(message)
        if busy:
            self.progress.set(0)


if __name__ == "__main__":
    try:
        MediaDownloader().mainloop()
    except DownloaderError as error:
        messagebox.showerror("실행 오류", str(error))
