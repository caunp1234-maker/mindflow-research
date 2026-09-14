-- docs/data-model.md §6 AssessmentResponse. 채점은 클라이언트(public/js/scoring.js)에서
-- server/public/assessments-ssd.json 기준으로 계산해 결과를 저장한다 — 서버는 재계산하지 않는다
-- (Phase 2 본작업에서 서버 측 재검증을 추가할 수 있음, 지금은 신뢰 경계 밖의 위협은 없다고 가정:
-- 내부 연구원만 쓰는 도구이므로).

create table assessment_responses (
  id                 uuid primary key default gen_random_uuid(),
  subject_visit_id   uuid not null references subject_visits(id) on delete cascade,
  assessment_id      text not null,             -- phq15 | ssd12 | bdi2 | bai | asi3 | whoqol_bref | khaq
  item_responses     jsonb not null,             -- { "1": 2, "2": 0, ... }
  total_score        numeric,                    -- WHOQOL-BREF처럼 단일 총점이 없는 경우 null
  severity_key       text,
  domain_scores      jsonb,                      -- WHOQOL-BREF 도메인별 0-100 점수
  safety_flag        jsonb,                       -- BDI-II 9번 안전 경로 결과
  computed_at        timestamptz not null default now(),
  created_by         uuid references users(id),
  unique (subject_visit_id, assessment_id)
);

create index idx_assessment_responses_visit on assessment_responses(subject_visit_id);
