import unittest
from pathlib import Path
from unittest.mock import patch

from engine import DownloadOptions, build_download_command, parse_progress, validate_url


class EngineTests(unittest.TestCase):
    def test_validates_http_urls(self):
        self.assertEqual(validate_url(" https://example.com/video "), "https://example.com/video")
        with self.assertRaises(ValueError):
            validate_url("file:///tmp/video.mp4")

    @patch("engine.base_command", return_value=["yt-dlp", "--ignore-config"])
    def test_builds_audio_command(self, _base):
        command = build_download_command(
            "https://example.com/watch?v=1", Path("downloads"),
            DownloadOptions(mode="audio", audio_format="mp3"),
        )
        self.assertIn("--extract-audio", command)
        self.assertIn("mp3", command)
        self.assertEqual(command[-1], "https://example.com/watch?v=1")

    @patch("engine.base_command", return_value=["yt-dlp", "--ignore-config"])
    def test_builds_bounded_video_command(self, _base):
        command = build_download_command(
            "https://example.com/video", Path("downloads"),
            DownloadOptions(mode="video", video_quality="720"),
        )
        self.assertIn("bestvideo[height<=720]+bestaudio/best[height<=720]/best", command)

    def test_parses_progress(self):
        parsed = parse_progress("[download]  42.5% of 10.00MiB at 2.00MiB/s ETA 00:03")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed[0], 42.5)
        self.assertEqual(parsed[1], "2.00MiB/s · 남은 시간 00:03")


if __name__ == "__main__":
    unittest.main()
