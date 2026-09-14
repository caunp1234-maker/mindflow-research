const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function toResponse(row) {
  return {
    id: row.id,
    subjectVisitId: row.subject_visit_id,
    assessmentId: row.assessment_id,
    itemResponses: row.item_responses,
    totalScore: row.total_score === null ? null : Number(row.total_score),
    severityKey: row.severity_key,
    domainScores: row.domain_scores,
    safetyFlag: row.safety_flag,
    computedAt: row.computed_at,
  };
}

// GET /visits/:visitId/assessment-responses — 한 방문의 척도 결과 전체(척도 결과 입력 탭 초기 로드용)
router.get('/visits/:visitId/assessment-responses', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'select * from assessment_responses where subject_visit_id = $1',
    [req.params.visitId]
  );
  res.json(rows.map(toResponse));
}));

// PUT /visits/:visitId/assessment-responses/:assessmentId — 채점 결과 저장(클라이언트가 계산해서 보냄)
router.put(
  '/visits/:visitId/assessment-responses/:assessmentId',
  requireRole('admin', 'researcher'),
  asyncHandler(async (req, res) => {
    const { itemResponses, totalScore, severityKey, domainScores, safetyFlag } = req.body || {};
    if (!itemResponses) return res.status(400).json({ error: 'itemResponses는 필수입니다.' });
    const { rows } = await db.query(
      `insert into assessment_responses
         (subject_visit_id, assessment_id, item_responses, total_score, severity_key,
          domain_scores, safety_flag, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (subject_visit_id, assessment_id) do update set
         item_responses = excluded.item_responses,
         total_score = excluded.total_score,
         severity_key = excluded.severity_key,
         domain_scores = excluded.domain_scores,
         safety_flag = excluded.safety_flag,
         computed_at = now(),
         created_by = excluded.created_by
       returning *`,
      [req.params.visitId, req.params.assessmentId, JSON.stringify(itemResponses),
        totalScore ?? null, severityKey || null,
        domainScores ? JSON.stringify(domainScores) : null,
        safetyFlag ? JSON.stringify(safetyFlag) : null, req.user.id]
    );
    res.status(201).json(toResponse(rows[0]));
  })
);

// GET /subjects/:subjectId/assessment-responses — 결과지표 비교 탭용: 이 피험자의 전체 방문 결과
router.get('/subjects/:subjectId/assessment-responses', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select ar.*, sv.visit_definition_id, vd.key as visit_key, vd.label as visit_label, vd.week_offset
     from assessment_responses ar
     join subject_visits sv on sv.id = ar.subject_visit_id
     join visit_definitions vd on vd.id = sv.visit_definition_id
     where sv.subject_id = $1
     order by vd.week_offset, ar.assessment_id`,
    [req.params.subjectId]
  );
  res.json(rows.map((r) => ({
    ...toResponse(r),
    visitKey: r.visit_key,
    visitLabel: r.visit_label,
    weekOffset: r.week_offset,
  })));
}));

module.exports = router;
