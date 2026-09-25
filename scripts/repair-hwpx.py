#!/usr/bin/env python3
"""Repair HWPX files produced by older browser converters."""

import argparse
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo


HWP_ATTRIBUTE = re.compile(rb"\s(?:ha|hh|hc|hp|hs|hp10):([A-Za-z_][\w.-]*)=")
PARAGRAPH = re.compile(rb"<hp:p(?=[\s>])([^>]*)>")


def repair(source: Path, destination: Path) -> None:
    paragraph_id = 0

    def fix_paragraph(match: re.Match[bytes]) -> bytes:
        nonlocal paragraph_id
        attributes = match.group(1)
        if re.search(rb"\sid=", attributes):
            return match.group(0)
        result = b'<hp:p id="' + str(paragraph_id).encode() + b'"' + attributes + b'>'
        paragraph_id += 1
        return result

    with ZipFile(source, "r") as archive, ZipFile(destination, "w") as output:
        mime = ZipInfo("mimetype")
        mime.compress_type = ZIP_STORED
        output.writestr(mime, b"application/hwp+zip")

        for info in archive.infolist():
            if info.filename == "mimetype":
                continue
            data = archive.read(info.filename)
            if info.filename.endswith((".xml", ".hpf")):
                data = HWP_ATTRIBUTE.sub(rb" \1=", data)
                data = PARAGRAPH.sub(fix_paragraph, data)
            target = ZipInfo(info.filename, date_time=info.date_time)
            target.external_attr = info.external_attr
            target.compress_type = ZIP_STORED if info.is_dir() else ZIP_DEFLATED
            output.writestr(target, data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    repair(args.source, args.destination)


if __name__ == "__main__":
    main()
