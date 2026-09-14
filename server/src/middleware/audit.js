const db = require('../db');

/**
 * docs/privacy-and-hosting.md §3: 모든 PII 조회/수정을 audit_logs에 남긴다.
 * 라우트 핸들러에서 명시적으로 호출한다 (자동 계측이 아님 — 어떤 필드가 PII인지는
 * 라우트마다 다르므로 호출부에서 diff를 직접 구성하게 한다).
 */
async function logAudit({ actorUserId, action, entityType, entityId, diff }) {
  await db.query(
    `insert into audit_logs (actor_user_id, action, entity_type, entity_id, diff)
     values ($1, $2, $3, $4, $5)`,
    [actorUserId, action, entityType, entityId, diff ? JSON.stringify(diff) : null]
  );
}

module.exports = { logAudit };
