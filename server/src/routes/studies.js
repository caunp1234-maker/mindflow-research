const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function toStudyResponse(row) {
  return {
    id: row.id,
    title: row.title,
    irbApprovalNo: row.irb_approval_no,
    status: row.status,
    inclusionCriteria: row.inclusion_criteria,
    exclusionCriteria: row.exclusion_criteria,
    targetN: row.target_n,
    precautions: row.precautions,
    reportGenerationEnabled: row.report_generation_enabled,
    deadline: row.deadline,
    assessmentIntroText: row.assessment_intro_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /studies — 연구 목록 (모든 로그인 사용자, pi 포함)
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await db.query('select * from studies order by created_at desc');
  res.json(rows.map(toStudyResponse));
}));

// GET /studies/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query('select * from studies where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '연구를 찾을 수 없습니다.' });
  res.json(toStudyResponse(rows[0]));
}));

// POST /studies — 연구 생성 (admin만. 슬라이드 21의 선정/제외기준·목표N·유의사항을 그대로 받는다)
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const {
    id, title, irbApprovalNo, status, inclusionCriteria, exclusionCriteria,
    targetN, precautions, reportGenerationEnabled, deadline, assessmentIntroText,
  } = req.body || {};
  if (!id || !title) {
    return res.status(400).json({ error: 'id, title은 필수입니다.' });
  }
  const { rows } = await db.query(
    `insert into studies
       (id, title, irb_approval_no, status, inclusion_criteria, exclusion_criteria,
        target_n, precautions, report_generation_enabled, deadline, assessment_intro_text)
     values ($1,$2,$3,coalesce($4,'recruiting'),coalesce($5,'{}'),coalesce($6,'{}'),
             $7,coalesce($8,'{}'),coalesce($9,true),$10,$11)
     returning *`,
    [id, title, irbApprovalNo || null, status, inclusionCriteria, exclusionCriteria,
      targetN || null, precautions, reportGenerationEnabled, deadline || null, assessmentIntroText || null]
  );
  res.status(201).json(toStudyResponse(rows[0]));
}));

// PATCH /studies/:id
router.patch('/:id', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const fields = {
    title: 'title', irb_approval_no: 'irbApprovalNo', status: 'status',
    inclusion_criteria: 'inclusionCriteria', exclusion_criteria: 'exclusionCriteria',
    target_n: 'targetN', precautions: 'precautions',
    report_generation_enabled: 'reportGenerationEnabled', deadline: 'deadline',
    assessment_intro_text: 'assessmentIntroText',
  };
  const sets = [];
  const values = [];
  for (const [column, bodyKey] of Object.entries(fields)) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, bodyKey)) {
      values.push(req.body[bodyKey]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  values.push(req.params.id);
  const { rows } = await db.query(
    `update studies set ${sets.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: '연구를 찾을 수 없습니다.' });
  res.json(toStudyResponse(rows[0]));
}));

// ── arms ──────────────────────────────────────────────────────────────
router.get('/:id/arms', asyncHandler(async (req, res) => {
  const { rows } = await db.query('select * from arms where study_id = $1 order by key', [req.params.id]);
  res.json(rows.map((r) => ({
    id: r.id, studyId: r.study_id, key: r.key, label: r.label,
    interventionType: r.intervention_type, interventionFrequency: r.intervention_frequency,
  })));
}));

router.post('/:id/arms', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const { key, label, interventionType, interventionFrequency } = req.body || {};
  if (!key || !label) return res.status(400).json({ error: 'key, label은 필수입니다.' });
  const { rows } = await db.query(
    `insert into arms (study_id, key, label, intervention_type, intervention_frequency)
     values ($1,$2,$3,$4,$5) returning *`,
    [req.params.id, key, label, interventionType || null, interventionFrequency || null]
  );
  res.status(201).json(rows[0]);
}));

// ── visit_definitions ────────────────────────────────────────────────
router.get('/:id/visit-definitions', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'select * from visit_definitions where study_id = $1 order by week_offset',
    [req.params.id]
  );
  res.json(rows.map((r) => ({
    id: r.id, studyId: r.study_id, key: r.key, label: r.label, weekOffset: r.week_offset,
    durationMinutes: r.duration_minutes, procedures: r.procedures, assessmentIds: r.assessment_ids,
    medicationCheckRequired: r.medication_check_required, instructionCardText: r.instruction_card_text,
  })));
}));

router.post('/:id/visit-definitions', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const {
    key, label, weekOffset, durationMinutes, procedures,
    assessmentIds, medicationCheckRequired, instructionCardText,
  } = req.body || {};
  if (!key || !label || weekOffset === undefined) {
    return res.status(400).json({ error: 'key, label, weekOffset은 필수입니다.' });
  }
  const { rows } = await db.query(
    `insert into visit_definitions
       (study_id, key, label, week_offset, duration_minutes, procedures,
        assessment_ids, medication_check_required, instruction_card_text)
     values ($1,$2,$3,$4,$5,coalesce($6,'{}'),coalesce($7,'{}'),coalesce($8,false),$9)
     returning *`,
    [req.params.id, key, label, weekOffset, durationMinutes || null, procedures,
      assessmentIds, medicationCheckRequired, instructionCardText || null]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
