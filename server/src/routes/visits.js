const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function toVisitResponse(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    visitDefinitionId: row.visit_definition_id,
    scheduledDate: row.scheduled_date,
    actualDate: row.actual_date,
    status: row.status,
    medicationChangeNoted: row.medication_change_noted,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /subjects/:subjectId/visits — 슬라이드 14의 "피험자별 방문 일정" 조회
router.get('/subjects/:subjectId/visits', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select v.* from subject_visits v
     where v.subject_id = $1
     order by (select week_offset from visit_definitions d where d.id = v.visit_definition_id)`,
    [req.params.subjectId]
  );
  res.json(rows.map(toVisitResponse));
}));

// POST /subjects/:subjectId/visits — 방문 스케줄 생성(슬라이드 14: 시작일 입력 → 방문별 일정표 자동 생성)
// 같은 (subject, visit_definition) 조합으로 다시 호출하면 예정일만 갱신한다(등록일자를 고쳐서
// 일정표를 재생성하는 프런트엔드의 "일정 생성" 버튼이 여러 번 눌려도 안전하도록).
router.post('/subjects/:subjectId/visits', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const { visitDefinitionId, scheduledDate } = req.body || {};
  if (!visitDefinitionId) return res.status(400).json({ error: 'visitDefinitionId는 필수입니다.' });
  const { rows } = await db.query(
    `insert into subject_visits (subject_id, visit_definition_id, scheduled_date)
     values ($1,$2,$3)
     on conflict (subject_id, visit_definition_id) do update set scheduled_date = excluded.scheduled_date
     returning *`,
    [req.params.subjectId, visitDefinitionId, scheduledDate || null]
  );
  res.status(201).json(toVisitResponse(rows[0]));
}));

// PATCH /visits/:id — 방문 완료 처리, 실제 방문일, 복용약물 변경 여부(슬라이드 17,18) 등
router.patch('/visits/:id', requireRole('admin', 'researcher'), asyncHandler(async (req, res) => {
  const fields = {
    scheduled_date: 'scheduledDate', actual_date: 'actualDate', status: 'status',
    medication_change_noted: 'medicationChangeNoted', notes: 'notes',
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
    `update subject_visits set ${sets.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: '방문 기록을 찾을 수 없습니다.' });
  res.json(toVisitResponse(rows[0]));
}));

module.exports = router;
