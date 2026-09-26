# My Media Downloader

링크에서 영상 또는 오디오를 저장하는 Windows/macOS 독립 프로그램입니다. 모든 다운로드와 변환은 사용자 컴퓨터에서 실행됩니다.

## 기능

- 공개 미디어 링크 분석
- MP4 영상 다운로드 및 최대 화질 선택
- MP3, M4A, Opus, WAV, FLAC 오디오 추출
- 제목·업로더·재생 시간 미리 확인
- 진행률 표시와 다운로드 취소
- Windows 포터블 ZIP 및 macOS 앱 빌드

다운로드할 권한이 있는 공개 콘텐츠에만 사용해야 합니다. DRM 또는 접근 제한을 우회하지 않습니다.

## 개발 실행

Python 3.11 이상이 필요합니다. `bin` 폴더에 `yt-dlp`, `ffmpeg`, `ffprobe`, `deno`를 넣거나 PATH에서 실행 가능하게 준비합니다.

## 인증서 오류

앱은 인증서 검증을 끄지 않고 Windows/macOS의 신뢰할 수 있는 시스템 인증서를 사용합니다. 회사나 학교 네트워크에서 `CERTIFICATE_VERIFY_FAILED`가 계속 나오면 운영체제의 날짜/시간을 확인하고, 네트워크 관리자가 제공한 루트 인증서가 시스템 신뢰 저장소에 설치되어 있는지 확인하세요.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Windows에서는 `.venv\\Scripts\\python.exe app.py`를 사용합니다.

## 테스트

```bash
python -m unittest discover -s tests
```

## 배포 빌드

GitHub 저장소에서 `Build desktop apps` 워크플로를 수동 실행하면 다음 결과물을 생성합니다.

- `MyMediaDownloader-Windows-x64.zip`
- `MyMediaDownloader-macOS-arm64.zip`
- `MyMediaDownloader-macOS-x64.zip`

서명되지 않은 초기 빌드이므로 Windows SmartScreen이나 macOS Gatekeeper 안내가 표시될 수 있습니다. 공개 배포 전에는 각 플랫폼 코드 서명을 권장합니다.
