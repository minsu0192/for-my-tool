# My Tools

PDF와 이미지를 서버 업로드 없이 브라우저에서 처리하는 개인용 도구 모음입니다.

## 제공 도구

- PDF 합치기
- PDF 분리
- PDF를 JPG/PNG로 변환
- PDF 용량 줄이기
- 이미지 압축
- 이미지를 PDF로 변환
- JPG/PNG/WebP 형식 변환
- MP4/WAV/M4A 등 미디어를 MP3/WAV로 변환
- HWP/HWPX 문서 열기 및 편집 (`rhwp`)
- DOCX/XLSX/PPTX/PDF 열기 및 편집 (별도 ONLYOFFICE 서버 필요)
- DOCX를 HWPX로 변환

## 문서 편집기

HWP/HWPX 편집기는 `@rhwp/editor`를 이용하며 브라우저에서 직접 실행됩니다.

Office 편집기는 [`office-server`](./office-server)의 Docker Compose 구성을 별도 서버에 배포해야 합니다.
배포 후 `config.js`의 `officeAppUrl`에 integration 서버의 HTTPS 주소를 입력하세요. 운영 환경에서는
두 서버 주소에 HTTPS와 접근 제어를 반드시 적용하세요.

## 배포

정적 사이트이므로 Cloudflare Pages에서 빌드 명령 없이 저장소 루트(`/`)를 배포하면 됩니다.

## 로컬 실행

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.
