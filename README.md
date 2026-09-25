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
- DOCX/XLSX/PPTX/PDF 열기 및 편집 (`ranuts/document`, 브라우저 로컬 처리)
- DOCX를 HWPX로 변환

Word → HWPX 변환 결과는 한글 편집기 호환성을 위해 MIME, 문단 ID, HWP XML 속성 네임스페이스를
정규화한 뒤 저장합니다. 복잡한 Word 전용 개체와 정밀 레이아웃은 변환 과정에서 달라질 수 있습니다.

## 문서 편집기

HWP/HWPX 편집기는 `@rhwp/editor`를 이용하며 브라우저에서 직접 실행됩니다.

Office 편집기는 AGPL-3.0 오픈소스인 [`ranuts/document`](https://github.com/ranuts/document)를 iframe으로
연결합니다. ONLYOFFICE WebAssembly 엔진이 브라우저 안에서 파일을 처리하므로 별도 문서 서버가 필요 없습니다.
기본 공개 편집기 대신 직접 Cloudflare Pages에 배포한 주소를 사용하려면 `config.js`의
`officeEditorUrl`을 변경하세요.

## 배포

정적 사이트이므로 Cloudflare Pages에서 빌드 명령 없이 저장소 루트(`/`)를 배포하면 됩니다.

## 로컬 실행

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.
