const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { encryptField, decryptField, encryptJson, decryptJson } = require('../lib/crypto');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

/**
 * docs/open-questions.md #2: pi(교수님) 역할의 PII 접근 범위가 아직 미확정이다.
 * 확정 전까지는 안전한 기본값으로 pi에게는 PII(name/contactPhone/demographics/medicalHistory/
 * idDocRefs)를 절대 내려보내지 않고, 인롤 현황 판단에 필요한 필드만 준다.
 * 이 기본값을 바꾸려면 이 함수만 수정하면 된다.
 */
function toSubjectResponse(row, viewerRole) {
  const base = {
    id: row.id,
    studyId: row.study_id,
    screeningNumber: row.screening_number,
    initials: row.initials,
    armId: row.arm_id,
    randomizedAt: row.randomized_at,
    enrollmentStatus: row.enrollment_status,
    consentDate: row.consent_date,
    withdrawalReason: row.withdrawal_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (viewerRole === 'pi') return base;
  return {
    ...base,
    name: decryptField(row.name_enc),
    contactPhone: decryptField(row.contact_phone_enc),
    demographics: decryptJson(row.demographics_enc),
    medicalHistory: decryptJson(row.medical_history_enc),
    medicationLog: row.medication_log,
    idDocRefs: row.id_doc_refs,
  };
}

// GET /studies/:studyId/subjects
router.get('/studies/:studyId/subjects', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'select * from subjects where study_id = $1 order by created_at desc',
    [req.params.studyId]
  );
  res.json(rows.map((r) => toSubjectResponse(r, req.user.role)));
}));

// POST /studies/:studyId/subjects — 인롤 (researcher/admin만, pi는 PII를 쓸 수 없어야 하므로 제외)
router.post('/studies/:studyId/subjects', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const {
    screeningNumber, initials, name, contactPhone, armId,
    consentDate, demographics, medicalHistory, idDocRefs,
  } = req.body || {};
  if (!screeningNumber || !initials) {
    return res.status(400).json({ error: 'screeningNumber, initials는 필수입니다.' });
  }
  const { rows } = await db.query(
    `insert into subjects
       (study_id, screening_number, initials, name_enc, contact_phone_enc, arm_id,
        consent_date, demographics_enc, medical_history_enc, id_doc_refs)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'[]'))
     returning *`,
    [req.params.studyId, screeningNumber, initials, encryptField(name), encryptField(contactPhone),
      armId || null, consentDate || null, encryptJson(demographics), encryptJson(medicalHistory),
      idDocRefs ? JSON.stringify(idDocRefs) : null]
  );
  const subject = rows[0];
  await logAudit({
    actorUserId: req.user.id, action: 'create', entityType: 'subject', entityId: subject.id,
    diff: { screeningNumber, initials },
  });
  res.status(201).json(toSubjectResponse(subject, req.user.role));
}));

// GET /subjects/:id — PII 조회이므로 audit_logs에 항상 기록한다.
router.get('/subjects/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query('select * from subjects where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '피험자를 찾을 수 없습니다.' });
  await logAudit({
    actorUserId: req.user.id, action: 'read', entityType: 'subject', entityId: req.params.id,
  });
  res.json(toSubjectResponse(rows[0], req.user.role));
}));

// PATCH /subjects/:id
router.patch('/subjects/:id', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const values = [];
  const push = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };

  if ('name' in body) push('name_enc', encryptField(body.name));
  if ('contactPhone' in body) push('contact_phone_enc', encryptField(body.contactPhone));
  if ('demographics' in body) push('demographics_enc', encryptJson(body.demographics));
  if ('medicalHistory' in body) push('medical_history_enc', encryptJson(body.medicalHistory));
  if ('medicationLog' in body) push('medication_log', JSON.stringify(body.medicationLog));
  if ('idDocRefs' in body) push('id_doc_refs', JSON.stringify(body.idDocRefs));
  if ('armId' in body) push('arm_id', body.armId);
  if ('randomizedAt' in body) push('randomized_at', body.randomizedAt);
  if ('enrollmentStatus' in body) push('enrollment_status', body.enrollmentStatus);
  if ('consentDate' in body) push('consent_date', body.consentDate);
  if ('withdrawalReason' in body) push('withdrawal_reason', body.withdrawalReason);

  if (sets.length === 0) return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  values.push(req.params.id);
  const { rows } = await db.query(
    `update subjects set ${sets.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: '피험자를 찾을 수 없습니다.' });

  await logAudit({
    actorUserId: req.user.id, action: 'update', entityType: 'subject', entityId: req.params.id,
    // 값 자체가 아니라 어떤 필드가 바뀌었는지만 남긴다(감사 로그도 PII를 평문으로 쌓지 않도록).
    diff: { updatedFields: Object.keys(body) },
  });
  res.json(toSubjectResponse(rows[0], req.user.role));
}));

module.exports = router;
