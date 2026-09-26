# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

root = Path(SPECPATH)
separator = ";" if __import__("os").name == "nt" else ":"
bins = []
for name in ("yt-dlp", "ffmpeg", "ffprobe", "deno"):
    suffix = ".exe" if __import__("os").name == "nt" else ""
    path = root / "bin" / f"{name}{suffix}"
    if path.exists():
        bins.append((str(path), "bin"))

a = Analysis(["app.py"], pathex=[str(root)], binaries=bins, datas=[], hiddenimports=[], hookspath=[])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="MyMediaDownloader", console=False)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="MyMediaDownloader")

if __import__("sys").platform == "darwin":
    app = BUNDLE(coll, name="My Media Downloader.app", bundle_identifier="com.mytools.media-downloader")

