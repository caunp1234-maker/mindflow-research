const path = require('path');
const express = require('express');
const config = require('./config');
const authRoutes = require('./routes/auth');
const studiesRoutes = require('./routes/studies');
const subjectsRoutes = require('./routes/subjects');
const visitsRoutes = require('./routes/visits');
const assessmentResponsesRoutes = require('./routes/assessmentResponses');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/studies', studiesRoutes);
// subjects/visits/assessment-responses 라우터는 /studies/:studyId/subjects, /subjects/:id,
// /visits/:visitId/... 등 여러 프리픽스를 함께 다루므로 루트에 마운트한다.
app.use('/', subjectsRoutes);
app.use('/', visitsRoutes);
app.use('/', assessmentResponsesRoutes);

// 프런트엔드(웹앱)는 public/ 아래 정적 파일로 같은 서버에서 서빙한다.
app.use(express.static(path.join(__dirname, '..', 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 내부 오류' });
});

app.listen(config.port, () => {
  console.log(`mindflow-research-server listening on :${config.port}`);
});
