/* global PDFLib, pdfjsLib, JSZip */

const toolConfigs = {
  merge: {
    title: 'PDF 합치기', eyebrow: 'PDF TOOL', accept: '.pdf,application/pdf', multiple: true,
    description: '선택한 순서대로 PDF를 하나의 문서로 합칩니다.', action: 'PDF 합치기',
    options: () => ''
  },
  split: {
    title: 'PDF 분리', eyebrow: 'PDF TOOL', accept: '.pdf,application/pdf', multiple: false,
    description: '페이지 범위를 입력하거나 모든 페이지를 각각 분리합니다.', action: 'PDF 분리하기',
    options: () => `<label class="option wide">페이지 선택
      <input id="pageRange" type="text" placeholder="예: 1-3, 5, 8-10 (비우면 전체 개별 분리)">
    </label>`
  },
  'pdf-image': {
    title: 'PDF → 이미지', eyebrow: 'PDF TOOL', accept: '.pdf,application/pdf', multiple: false,
    description: 'PDF의 모든 페이지를 이미지로 변환해 ZIP으로 저장합니다.', action: '이미지로 변환',
    options: () => `${formatSelect('imageFormat', '이미지 형식', ['JPG', 'PNG'])}
      ${scaleSelect()}`
  },
  'pdf-compress': {
    title: 'PDF 용량 줄이기', eyebrow: 'PDF TOOL', accept: '.pdf,application/pdf', multiple: false,
    description: 'PDF 페이지를 이미지로 최적화해 파일 크기를 줄입니다. 텍스트 선택 기능은 사라질 수 있습니다.', action: 'PDF 압축',
    options: () => `<label class="option wide">압축 강도<select id="pdfQuality"><option value="0.72,1.5">균형 (추천)</option><option value="0.55,1.25">강하게</option><option value="0.85,2">화질 우선</option></select></label>`
  },
  compress: {
    title: '이미지 압축', eyebrow: 'IMAGE TOOL', accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: '크기는 유지하고 화질을 조절해 파일 용량을 줄입니다.', action: '이미지 압축',
    options: () => `<label class="option wide">화질 <span id="qualityValue">80%</span>
      <span class="range-row"><span>작게</span><input id="quality" type="range" min="20" max="95" value="80"><span>선명</span></span>
    </label>`
  },
  'image-pdf': {
    title: '이미지 → PDF', eyebrow: 'IMAGE TOOL', accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: '이미지 한 장을 한 페이지로 배치해 PDF로 만듭니다.', action: 'PDF 만들기',
    options: () => `<label class="option">페이지 크기<select id="pageSize"><option value="fit">이미지에 맞춤</option><option value="a4">A4</option></select></label>
      <label class="option">여백<select id="margin"><option value="0">없음</option><option value="24" selected>보통</option><option value="48">넓게</option></select></label>`
  },
  convert: {
    title: '이미지 형식 변환', eyebrow: 'IMAGE TOOL', accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: '이미지를 JPG, PNG 또는 WebP 형식으로 바꿉니다.', action: '형식 변환',
    options: () => `${formatSelect('convertFormat', '변환 형식', ['JPG', 'PNG', 'WEBP'])}
      <label class="option">품질<select id="convertQuality"><option value="0.95">최고</option><option value="0.85" selected>높음</option><option value="0.7">보통</option></select></label>`
  },
  'audio-convert': {
    title: '오디오 변환', eyebrow: 'AUDIO TOOL', accept: 'audio/*,video/mp4,video/webm,.m4a,.mov,.avi,.mkv', multiple: true,
    description: 'MP4, WAV, M4A 등 미디어 파일의 오디오를 MP3 또는 WAV로 변환합니다.', action: '오디오 변환',
    options: () => `<label class="option">출력 형식<select id="audioFormat"><option value="mp3">MP3</option><option value="wav">WAV</option></select></label>
      <label class="option">음질<select id="audioBitrate"><option value="128k">128 kbps</option><option value="192k" selected>192 kbps</option><option value="320k">320 kbps</option></select></label>`
  },
  'docx-hwpx': {
    title: 'Word → 한글', eyebrow: 'DOCUMENT TOOL', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', multiple: false,
    description: 'DOCX를 표준 한글 문서 형식인 HWPX로 변환합니다. 복잡한 Word 레이아웃은 일부 달라질 수 있습니다.', action: 'HWPX로 변환',
    options: () => ''
  }
};

const dialog = document.querySelector('#toolDialog');
const fileInput = document.querySelector('#fileInput');
const dropZone = document.querySelector('#dropZone');
const fileList = document.querySelector('#fileList');
const options = document.querySelector('#options');
const status = document.querySelector('#status');
const runButton = document.querySelector('#runButton');
let activeTool = null;
let selectedFiles = [];
let hwpEditor = null;
let workspaceMode = null;
let officeEditorReady = false;
let pendingOfficeFile = null;
let currentOfficeExtension = 'docx';
let officeMessageId = 0;

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.tool-card').forEach(card => {
    card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
  });
  document.querySelectorAll('.category-heading').forEach(heading => {
    heading.hidden = button.dataset.filter !== 'all' && heading.dataset.category !== button.dataset.filter;
  });
}));

document.querySelectorAll('.tool-card').forEach(card => card.addEventListener('click', () => {
  if (card.dataset.tool === 'hwp-editor') return openDocumentWorkspace('hwp');
  if (card.dataset.tool === 'office-editor') return openDocumentWorkspace('office');
  openTool(card.dataset.tool);
}));
document.querySelector('.close-button').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

function openTool(tool) {
  activeTool = tool;
  selectedFiles = [];
  const config = toolConfigs[tool];
  document.querySelector('#dialogEyebrow').textContent = config.eyebrow;
  document.querySelector('#dialogTitle').textContent = config.title;
  document.querySelector('#dialogDescription').textContent = config.description;
  fileInput.accept = config.accept;
  fileInput.multiple = config.multiple;
  document.querySelector('#acceptHint').textContent = `${config.multiple ? '여러 파일을 선택할 수 있습니다' : '파일 1개를 선택하세요'} · 클릭해서 찾기`;
  options.innerHTML = config.options();
  status.textContent = '';
  status.className = 'status';
  renderFiles();
  bindOptionEvents();
  dialog.showModal();
}

function bindOptionEvents() {
  const quality = document.querySelector('#quality');
  if (quality) quality.addEventListener('input', () => { document.querySelector('#qualityValue').textContent = `${quality.value}%`; });
}

fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
  event.preventDefault(); dropZone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => {
  event.preventDefault(); dropZone.classList.remove('dragover');
}));
dropZone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));

function addFiles(files) {
  const config = toolConfigs[activeTool];
  const accepted = files.filter(file => matchesAccept(file, config.accept));
  if (!accepted.length) return showStatus('지원하지 않는 파일 형식입니다.', true);
  selectedFiles = config.multiple ? [...selectedFiles, ...accepted] : [accepted[0]];
  fileInput.value = '';
  showStatus('');
  renderFiles();
}

function matchesAccept(file, accept) {
  return accept.split(',').some(rule => rule.startsWith('.') ? file.name.toLowerCase().endsWith(rule) : file.type === rule);
}

function renderFiles() {
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span>${escapeHtml(file.name)}</span><small>${formatBytes(file.size)}</small><button class="remove-file" aria-label="파일 제거">×</button>`;
    item.querySelector('button').addEventListener('click', () => { selectedFiles.splice(index, 1); renderFiles(); });
    fileList.appendChild(item);
  });
  runButton.disabled = !selectedFiles.length;
  runButton.textContent = selectedFiles.length ? toolConfigs[activeTool].action : '파일을 먼저 선택하세요';
}

runButton.addEventListener('click', async () => {
  if (!selectedFiles.length) return;
  runButton.disabled = true;
  showStatus('파일을 처리하고 있습니다…');
  try {
    const handlers = { merge: mergePdfs, split: splitPdf, 'pdf-image': pdfToImages, 'pdf-compress': compressPdf, compress: compressImages, 'image-pdf': imagesToPdf, convert: convertImages, 'audio-convert': convertAudio, 'docx-hwpx': docxToHwpx };
    await handlers[activeTool]();
    showStatus('완료되었습니다. 다운로드를 확인하세요.');
  } catch (error) {
    console.error(error);
    showStatus(error.message || '처리 중 오류가 발생했습니다.', true);
  } finally {
    runButton.disabled = false;
  }
});

async function mergePdfs() {
  const output = await PDFLib.PDFDocument.create();
  for (let index = 0; index < selectedFiles.length; index++) {
    showStatus(`${index + 1}/${selectedFiles.length} PDF를 합치는 중…`);
    const source = await PDFLib.PDFDocument.load(await selectedFiles[index].arrayBuffer());
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach(page => output.addPage(page));
  }
  downloadBlob(new Blob([await output.save()], { type: 'application/pdf' }), 'merged.pdf');
}

async function splitPdf() {
  const source = await PDFLib.PDFDocument.load(await selectedFiles[0].arrayBuffer());
  const indices = parsePageRange(document.querySelector('#pageRange').value, source.getPageCount());
  const zip = new JSZip();
  for (let i = 0; i < indices.length; i++) {
    showStatus(`${i + 1}/${indices.length} 페이지를 분리하는 중…`);
    const output = await PDFLib.PDFDocument.create();
    const [page] = await output.copyPages(source, [indices[i]]);
    output.addPage(page);
    zip.file(`page-${String(indices[i] + 1).padStart(3, '0')}.pdf`, await output.save());
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName(selectedFiles[0].name)}-split.zip`);
}

async function pdfToImages() {
  const format = document.querySelector('#imageFormat').value.toLowerCase();
  const scale = Number(document.querySelector('#renderScale').value);
  const pdf = await pdfjsLib.getDocument({ data: await selectedFiles[0].arrayBuffer() }).promise;
  const zip = new JSZip();
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    showStatus(`${pageNumber}/${pdf.numPages} 페이지를 변환하는 중…`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, mime, .92);
    zip.file(`page-${String(pageNumber).padStart(3, '0')}.${format === 'png' ? 'png' : 'jpg'}`, blob);
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName(selectedFiles[0].name)}-images.zip`);
}

async function compressPdf() {
  const [quality, scale] = document.querySelector('#pdfQuality').value.split(',').map(Number);
  const source = await pdfjsLib.getDocument({ data: await selectedFiles[0].arrayBuffer() }).promise;
  const output = await PDFLib.PDFDocument.create();
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
    showStatus(`${pageNumber}/${source.numPages} 페이지를 압축하는 중…`);
    const sourcePage = await source.getPage(pageNumber);
    const baseViewport = sourcePage.getViewport({ scale: 1 });
    const viewport = sourcePage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await sourcePage.render({ canvasContext: context, viewport }).promise;
    const jpg = await canvasToBlob(canvas, 'image/jpeg', quality);
    const image = await output.embedJpg(await jpg.arrayBuffer());
    const page = output.addPage([baseViewport.width, baseViewport.height]);
    page.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
  }
  const blob = new Blob([await output.save()], { type: 'application/pdf' });
  downloadBlob(blob, `${baseName(selectedFiles[0].name)}-compressed.pdf`);
}

async function compressImages() {
  const quality = Number(document.querySelector('#quality').value) / 100;
  const outputs = [];
  for (let i = 0; i < selectedFiles.length; i++) {
    showStatus(`${i + 1}/${selectedFiles.length} 이미지를 압축하는 중…`);
    const file = selectedFiles[i];
    const image = await loadImage(file);
    const canvas = imageToCanvas(image, file.type === 'image/jpeg');
    const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    outputs.push({ name: `${baseName(file.name)}-compressed.${extensionFor(mime)}`, blob: await canvasToBlob(canvas, mime, quality) });
  }
  await downloadOutputs(outputs, 'compressed-images.zip');
}

async function imagesToPdf() {
  const pdf = await PDFLib.PDFDocument.create();
  const pageSize = document.querySelector('#pageSize').value;
  const margin = Number(document.querySelector('#margin').value);
  for (let i = 0; i < selectedFiles.length; i++) {
    showStatus(`${i + 1}/${selectedFiles.length} 이미지를 PDF에 넣는 중…`);
    const file = selectedFiles[i];
    const normalized = await normalizeForPdf(file);
    const embedded = normalized.type === 'image/png' ? await pdf.embedPng(await normalized.arrayBuffer()) : await pdf.embedJpg(await normalized.arrayBuffer());
    const natural = embedded.scale(1);
    const dimensions = pageSize === 'a4' ? [595.28, 841.89] : [natural.width + margin * 2, natural.height + margin * 2];
    const page = pdf.addPage(dimensions);
    const ratio = Math.min((dimensions[0] - margin * 2) / natural.width, (dimensions[1] - margin * 2) / natural.height, 1);
    const width = natural.width * ratio; const height = natural.height * ratio;
    page.drawImage(embedded, { x: (dimensions[0] - width) / 2, y: (dimensions[1] - height) / 2, width, height });
  }
  downloadBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'images.pdf');
}

async function convertImages() {
  const format = document.querySelector('#convertFormat').value.toLowerCase();
  const quality = Number(document.querySelector('#convertQuality').value);
  const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  const outputs = [];
  for (let i = 0; i < selectedFiles.length; i++) {
    showStatus(`${i + 1}/${selectedFiles.length} 이미지를 변환하는 중…`);
    const image = await loadImage(selectedFiles[i]);
    const canvas = imageToCanvas(image, mime === 'image/jpeg');
    outputs.push({ name: `${baseName(selectedFiles[i].name)}.${format}`, blob: await canvasToBlob(canvas, mime, quality) });
  }
  await downloadOutputs(outputs, `converted-${format}.zip`);
}

let ffmpegInstance = null;
async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (!window.FFmpegWASM || !window.FFmpegUtil) throw new Error('오디오 변환 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
  showStatus('오디오 변환 엔진을 처음 한 번 불러오는 중…');
  const ffmpeg = new FFmpegWASM.FFmpeg();
  ffmpeg.on('progress', ({ progress }) => showStatus(`변환 중… ${Math.max(0, Math.min(100, Math.round(progress * 100)))}%`));
  const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await FFmpegUtil.toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await FFmpegUtil.toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm')
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function convertAudio() {
  const format = document.querySelector('#audioFormat').value;
  const bitrate = document.querySelector('#audioBitrate').value;
  const ffmpeg = await getFfmpeg();
  const outputs = [];
  for (let index = 0; index < selectedFiles.length; index++) {
    const file = selectedFiles[index];
    const inputName = `input-${index}.${file.name.split('.').pop() || 'bin'}`;
    const outputName = `output-${index}.${format}`;
    showStatus(`${index + 1}/${selectedFiles.length} ${file.name} 변환 준비 중…`);
    await ffmpeg.writeFile(inputName, await FFmpegUtil.fetchFile(file));
    const args = format === 'mp3'
      ? ['-i', inputName, '-vn', '-codec:a', 'libmp3lame', '-b:a', bitrate, outputName]
      : ['-i', inputName, '-vn', '-codec:a', 'pcm_s16le', outputName];
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    outputs.push({ name: `${baseName(file.name)}.${format}`, blob: new Blob([data.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' }) });
    await ffmpeg.deleteFile(inputName); await ffmpeg.deleteFile(outputName);
  }
  await downloadOutputs(outputs, `converted-audio-${format}.zip`);
}

async function docxToHwpx() {
  if (!window.mammoth) throw new Error('Word 변환 엔진을 불러오지 못했습니다.');
  showStatus('Word 문서의 내용을 읽는 중…');
  const result = await window.mammoth.convertToHtml({ arrayBuffer: await selectedFiles[0].arrayBuffer() });
  showStatus('HWPX 문서를 만드는 중…');
  const { htmlToHwpx } = await import('https://cdn.jsdelivr.net/npm/@ssabrojs/hwpxjs@0.4.0/dist/browser/hwpxjs.browser.mjs');
  const generated = await htmlToHwpx(result.value);
  showStatus('한글 편집기 호환 형식으로 정리하는 중…');
  const bytes = await normalizeHwpx(generated);
  downloadBlob(new Blob([bytes], { type: 'application/hwp+zip' }), `${baseName(selectedFiles[0].name)}.hwpx`);
}

async function normalizeHwpx(input) {
  const source = await JSZip.loadAsync(input);
  const output = new JSZip();
  output.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  let paragraphId = 0;
  const hwpNamespaces = new Set([
    'http://www.hancom.co.kr/hwpml/2011/app',
    'http://www.hancom.co.kr/hwpml/2011/core',
    'http://www.hancom.co.kr/hwpml/2011/head',
    'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'http://www.hancom.co.kr/hwpml/2011/section',
    'http://www.hancom.co.kr/hwpml/2016/paragraph'
  ]);

  for (const [path, entry] of Object.entries(source.files)) {
    if (path === 'mimetype') continue;
    if (entry.dir) {
      output.folder(path.replace(/\/$/, ''));
      continue;
    }
    if (!path.endsWith('.xml') && !path.endsWith('.hpf')) {
      output.file(path, await entry.async('uint8array'));
      continue;
    }

    const xmlText = await entry.async('text');
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error(`${path} XML을 정리하지 못했습니다.`);

    xml.querySelectorAll('*').forEach(element => {
      [...element.attributes].forEach(attribute => {
        if (!attribute.prefix || !hwpNamespaces.has(attribute.namespaceURI)) return;
        const value = attribute.value;
        const name = attribute.localName;
        element.removeAttributeNode(attribute);
        if (!element.hasAttribute(name)) element.setAttribute(name, value);
      });
      if (element.localName === 'p' && element.namespaceURI === 'http://www.hancom.co.kr/hwpml/2011/paragraph' && !element.hasAttribute('id')) {
        element.setAttribute('id', String(paragraphId++));
      }
    });

    const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
    output.file(path, declaration + new XMLSerializer().serializeToString(xml.documentElement));
  }

  return output.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function parsePageRange(value, total) {
  if (!value.trim()) return Array.from({ length: total }, (_, index) => index);
  const pages = new Set();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('페이지 범위를 확인하세요. 예: 1-3, 5');
    const start = Number(match[1]); const end = Number(match[2] || match[1]);
    if (start < 1 || end > total || start > end) throw new Error(`페이지는 1부터 ${total}까지 입력할 수 있습니다.`);
    for (let page = start; page <= end; page++) pages.add(page - 1);
  }
  return [...pages];
}

async function normalizeForPdf(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file;
  const image = await loadImage(file);
  return canvasToBlob(imageToCanvas(image, false), 'image/png', 1);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}을 읽을 수 없습니다.`)); };
    image.src = url;
  });
}

function imageToCanvas(image, whiteBackground) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (whiteBackground) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(image, 0, 0);
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.')), type, quality));
}

async function downloadOutputs(outputs, zipName) {
  if (outputs.length === 1) return downloadBlob(outputs[0].blob, outputs[0].name);
  const zip = new JSZip(); outputs.forEach(output => zip.file(output.name, output.blob));
  downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatSelect(id, label, values) {
  return `<label class="option">${label}<select id="${id}">${values.map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>`;
}
function scaleSelect() {
  return '<label class="option">해상도<select id="renderScale"><option value="1.5">보통</option><option value="2" selected>선명</option><option value="3">매우 선명</option></select></label>';
}
function extensionFor(mime) { return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'; }
function baseName(name) { return name.replace(/\.[^.]+$/, ''); }
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
function showStatus(message, error = false) { status.textContent = message; status.className = `status${error ? ' error' : ''}`; }

const documentWorkspace = document.querySelector('#documentWorkspace');
const workspaceFileInput = document.querySelector('#workspaceFileInput');
const workspaceStatus = document.querySelector('#workspaceStatus');
const hwpEditorMount = document.querySelector('#hwpEditorMount');
const officeEditorFrame = document.querySelector('#officeEditorFrame');

async function openDocumentWorkspace(mode) {
  workspaceMode = mode;
  documentWorkspace.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#workspaceTitle').textContent = mode === 'hwp' ? '한글 문서 편집기' : 'Office 문서 편집기';
  workspaceStatus.textContent = mode === 'hwp' ? 'HWP 또는 HWPX 파일을 선택하세요' : 'DOCX, XLSX, PPTX 또는 PDF 파일을 선택하세요';
  workspaceFileInput.accept = mode === 'hwp' ? '.hwp,.hwpx' : '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf';
  hwpEditorMount.hidden = mode !== 'hwp';
  officeEditorFrame.hidden = mode !== 'office';
  document.querySelector('#workspaceSave').hidden = mode !== 'office';
  workspaceFileInput.value = '';
  if (mode === 'hwp' && !hwpEditor) {
    workspaceStatus.textContent = '한글 편집기를 불러오는 중…';
    try {
      const { createEditor } = await import('https://cdn.jsdelivr.net/npm/@rhwp/editor@0.8.6/index.js');
      hwpEditor = await createEditor(hwpEditorMount, { width: '100%', height: '100%' });
      workspaceStatus.textContent = 'HWP 또는 HWPX 파일을 선택하세요';
    } catch (error) {
      console.error(error);
      workspaceStatus.textContent = '한글 편집기를 불러오지 못했습니다. 인터넷 연결을 확인하세요.';
    }
  }
  if (mode === 'office' && !officeEditorFrame.src) {
    const editorUrl = window.MY_TOOLS_CONFIG && window.MY_TOOLS_CONFIG.officeEditorUrl;
    if (!editorUrl) {
      workspaceStatus.textContent = 'Office 편집기 주소가 설정되지 않았습니다.';
    } else {
      officeEditorFrame.src = editorUrl;
      workspaceStatus.textContent = '무료 Office 편집기를 불러오는 중…';
    }
  }
}

document.querySelector('#workspaceClose').addEventListener('click', () => {
  documentWorkspace.hidden = true;
  document.body.style.overflow = '';
});

workspaceFileInput.addEventListener('change', async () => {
  const file = workspaceFileInput.files[0];
  if (!file) return;
  try {
    if (workspaceMode === 'hwp') {
      if (!hwpEditor) throw new Error('한글 편집기가 준비되지 않았습니다. 편집기를 닫았다가 다시 열어 주세요.');
      const isHwpx = file.name.toLowerCase().endsWith('.hwpx');
      workspaceStatus.textContent = isHwpx ? `${file.name} 구조 확인 및 보정 중…` : `${file.name} 여는 중…`;
      const fileBuffer = await file.arrayBuffer();
      const editorBytes = isHwpx ? await normalizeHwpx(fileBuffer) : fileBuffer;
      if (isHwpx) workspaceStatus.textContent = `${file.name} 편집기에 여는 중…`;
      const result = await hwpEditor.loadFile(editorBytes, file.name, {
        suppressDialogs: true,
        skipUnsavedGuard: false
      });
      workspaceStatus.textContent = `${file.name} · ${result.pageCount || '-'}페이지${isHwpx ? ' · 호환성 검사 완료' : ''}`;
    } else {
      await openOfficeFile(file);
    }
  } catch (error) {
    console.error(error);
    const isHwpx = file.name.toLowerCase().endsWith('.hwpx');
    workspaceStatus.textContent = isHwpx
      ? `HWPX 구조를 읽지 못했습니다: ${error.message || '손상되었거나 지원하지 않는 문서입니다.'}`
      : `HWP 문서를 열지 못했습니다: ${error.message || '손상되었거나 지원하지 않는 문서입니다.'}`;
  } finally {
    workspaceFileInput.value = '';
  }
});

async function openOfficeFile(file) {
  pendingOfficeFile = file;
  currentOfficeExtension = file.name.split('.').pop().toLowerCase();
  workspaceStatus.textContent = officeEditorReady ? `${file.name} 여는 중…` : '편집기 준비 후 자동으로 문서를 엽니다…';
  if (officeEditorReady) sendOfficeMessage('document:open-file', { file, readonly: false });
}

function officeEditorOrigin() {
  return new URL(window.MY_TOOLS_CONFIG.officeEditorUrl).origin;
}

function sendOfficeMessage(type, payload = {}) {
  officeEditorFrame.contentWindow.postMessage({ id: String(++officeMessageId), type, payload }, officeEditorOrigin());
}

window.addEventListener('message', event => {
  if (!window.MY_TOOLS_CONFIG.officeEditorUrl || event.origin !== officeEditorOrigin()) return;
  const { type, payload } = event.data || {};
  if (!type || !type.startsWith('document:')) return;
  if (type === 'document:ready') {
    officeEditorReady = true;
    workspaceStatus.textContent = 'Office 문서를 선택하세요';
    if (pendingOfficeFile) sendOfficeMessage('document:open-file', { file: pendingOfficeFile, readonly: false });
  } else if (type === 'document:opened') {
    workspaceStatus.textContent = `${pendingOfficeFile ? pendingOfficeFile.name : '문서'} · 브라우저에서 편집 중`;
  } else if (type === 'document:saved' && payload && payload.file) {
    downloadBlob(payload.file, payload.fileName || `edited.${currentOfficeExtension}`);
    workspaceStatus.textContent = '수정한 문서를 내 기기에 저장했습니다.';
  } else if (type === 'document:error') {
    workspaceStatus.textContent = payload && payload.message ? payload.message : 'Office 문서 처리 중 오류가 발생했습니다.';
  }
});

document.querySelector('#workspaceSave').addEventListener('click', () => {
  if (!officeEditorReady || !pendingOfficeFile) {
    workspaceStatus.textContent = '먼저 Office 문서를 여세요.';
    return;
  }
  workspaceStatus.textContent = '수정한 문서를 내보내는 중…';
  sendOfficeMessage('document:save', { targetExt: currentOfficeExtension.toUpperCase() });
});
