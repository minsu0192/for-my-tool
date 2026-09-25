import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const app = express();
const port = Number(process.env.PORT || 3000);
const publicUrl = String(process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const documentServerUrl = String(process.env.DOCUMENT_SERVER_URL || 'http://localhost:8080').replace(/\/$/, '');
const documentServerPublicUrl = String(process.env.DOCUMENT_SERVER_PUBLIC_URL || documentServerUrl).replace(/\/$/, '');
const jwtSecret = process.env.JWT_SECRET;
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:8000';
const dataDir = process.env.DATA_DIR || '/data';
const uploadDir = path.join(dataDir, 'documents');

if (!jwtSecret) throw new Error('JWT_SECRET 환경 변수가 필요합니다.');
await fs.mkdir(uploadDir, { recursive: true });

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use('/files', express.static(uploadDir, { fallthrough: false }));

const allowedExtensions = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf']);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, done) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      done(null, `${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, done) => {
    const accepted = allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    done(accepted ? null : new Error('지원하지 않는 문서 형식입니다.'), accepted);
  }
});

const records = new Map();

app.get('/health', (_request, response) => response.json({ ok: true }));

app.post('/api/documents', upload.single('document'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: '문서 파일이 필요합니다.' });
  const id = path.parse(request.file.filename).name;
  records.set(id, { storedName: request.file.filename, displayName: request.file.originalname });
  response.status(201).json({ id, editorUrl: `/editor/${id}` });
});

app.get('/editor/:id', (request, response) => {
  const record = records.get(request.params.id);
  if (!record) return response.status(404).send('문서를 찾을 수 없습니다.');
  const extension = path.extname(record.storedName).slice(1);
  const type = ['xls', 'xlsx'].includes(extension) ? 'cell' : ['ppt', 'pptx'].includes(extension) ? 'slide' : extension === 'pdf' ? 'pdf' : 'word';
  const config = {
    documentType: type,
    type: 'desktop', width: '100%', height: '100%',
    document: {
      fileType: extension,
      key: `${request.params.id}-${Date.now()}`,
      title: record.displayName,
      url: `${publicUrl}/files/${record.storedName}`,
      permissions: { edit: true, download: true, print: true }
    },
    editorConfig: {
      callbackUrl: `${publicUrl}/api/callback/${request.params.id}`,
      lang: 'ko-KR', mode: 'edit',
      customization: { autosave: true, forcesave: true }
    }
  };
  config.token = jwt.sign(config, jwtSecret);
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  response.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(record.displayName)}</title><style>html,body,#editor{width:100%;height:100%;margin:0}</style></head><body><div id="editor"></div><script src="${documentServerPublicUrl}/web-apps/apps/api/documents/api.js"></script><script>new DocsAPI.DocEditor('editor',${safeConfig});</script></body></html>`);
});

app.post('/api/callback/:id', async (request, response) => {
  const record = records.get(request.params.id);
  if (!record) return response.status(404).json({ error: 1 });
  if ([2, 6].includes(request.body.status) && request.body.url) {
    const download = await fetch(request.body.url);
    if (!download.ok) return response.status(502).json({ error: 1 });
    const target = path.join(uploadDir, record.storedName);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, Buffer.from(await download.arrayBuffer()));
    await fs.rename(temporary, target);
  }
  response.json({ error: 0 });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(400).json({ error: error.message || '요청을 처리하지 못했습니다.' });
});

app.listen(port, () => console.log(`Office integration server listening on ${port}`));

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}
