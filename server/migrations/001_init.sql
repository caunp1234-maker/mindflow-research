-- Phase 1 스키마: users, studies, arms, visit_definitions, subjects, subject_visits, audit_logs.
-- 근거: docs/data-model.md. AssessmentResponse/CodingRecord/MessageLog/EmrMemoLog는 각각
-- Phase 2/5/4에서 추가한다 (이번 마이그레이션에는 포함하지 않음).

create extension if not exists pgcrypto;

-- ── users ──────────────────────────────────────────────────────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('researcher', 'pi', 'admin')),
  created_at    timestamptz not null default now()
);

-- ── studies ────────────────────────────────────────────────────────────
-- docs/data-model.md §1. id는 사람이 읽을 수 있는 슬러그(예: 'ssd_cbt')를 그대로 기본키로 쓴다.
create table studies (
  id                        text primary key,
  title                     text not null,
  irb_approval_no           text,
  status                    text not null default 'recruiting'
                              check (status in ('recruiting', 'active', 'closed')),
  inclusion_criteria        text[] not null default '{}',
  exclusion_criteria        text[] not null default '{}',
  target_n                  int,
  precautions               text[] not null default '{}',
  -- 결과보고서 자동 생성 대상 여부. SSD_CBT는 false (슬라이드 20).
  report_generation_enabled boolean not null default true,
  deadline                  date,
  -- 임상척도 사전 안내 설명문 (docs/message-templates.md §3, 원문 그대로 저장)
  assessment_intro_text     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ── arms (군) ──────────────────────────────────────────────────────────
create table arms (
  id                      uuid primary key default gen_random_uuid(),
  study_id                text not null references studies(id) on delete cascade,
  key                     text not null check (key in ('intervention', 'control')),
  label                   text not null,
  intervention_type       text,
  intervention_frequency  text,
  unique (study_id, key)
);

-- ── visit_definitions (방문 정의) ─────────────────────────────────────
-- docs/data-model.md의 VisitScheduleTemplate + VisitDefinition을, 방문 정의가 연구에 직접
-- 속하는 구조로 단순화했다(템플릿 엔터티를 따로 두지 않음). 연구당 방문 정의 집합이 곧 템플릿이다.
create table visit_definitions (
  id                          uuid primary key default gen_random_uuid(),
  study_id                    text not null references studies(id) on delete cascade,
  key                         text not null,          -- 예: baseline, week6, week11, week23
  label                       text not null,          -- 예: 사전평가
  week_offset                 int not null,           -- 동의서 작성일(V1) 기준 주차
  duration_minutes            int,
  procedures                  text[] not null default '{}',   -- 예: {임상척도, fNIRS}
  assessment_ids              text[] not null default '{}',   -- 이 방문에서 시행하는 척도 id
  medication_check_required   boolean not null default false,
  instruction_card_text       text,                    -- 방문별 환자 안내사항(슬라이드 10)
  unique (study_id, key)
);

-- ── subjects (피험자) ─────────────────────────────────────────────────
-- 결정 #3: 신분증/통장사본/가족관계증명서 파일은 앱에 저장하지 않고 메타데이터만 둔다(id_doc_refs).
-- name/contact_phone/demographics/medical_history는 애플리케이션 레이어에서 AES-256-GCM으로
-- 암호화한 base64 문자열을 저장한다(src/lib/crypto.js). DB는 암호문만 본다.
create table subjects (
  id                    uuid primary key default gen_random_uuid(),
  study_id              text not null references studies(id) on delete cascade,
  screening_number      text not null,
  initials              text not null,
  name_enc              text,             -- 암호화된 실명
  contact_phone_enc     text,             -- 암호화된 연락처
  arm_id                uuid references arms(id),
  randomized_at         timestamptz,
  enrollment_status     text not null default 'screening'
                          check (enrollment_status in
                            ('screening', 'enrolled', 'in_intervention', 'completed', 'withdrawn')),
  consent_date          date,
  demographics_enc      text,             -- 암호화된 JSON (생년월일·성별·학력 등, PDF 2쪽 문항)
  medical_history_enc   text,             -- 암호화된 JSON
  medication_log        jsonb not null default '[]',  -- 최초 조사 + 방문별 변경 이력
  id_doc_refs           jsonb not null default '[]',  -- [{docType, required, submitted, submittedAt, storageRef}]
  withdrawal_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (study_id, screening_number)
);

-- ── subject_visits (피험자별 방문) ────────────────────────────────────
create table subject_visits (
  id                        uuid primary key default gen_random_uuid(),
  subject_id                uuid not null references subjects(id) on delete cascade,
  visit_definition_id       uuid not null references visit_definitions(id),
  scheduled_date            date,
  actual_date               date,
  status                    text not null default 'scheduled'
                              check (status in ('scheduled', 'completed', 'no_show', 'cancelled')),
  medication_change_noted   boolean,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (subject_id, visit_definition_id)
);

-- ── audit_logs ─────────────────────────────────────────────────────────
-- docs/privacy-and-hosting.md §3: 모든 PII 조회/수정을 기록한다.
create table audit_logs (
  id              bigserial primary key,
  actor_user_id   uuid references users(id),
  action          text not null,       -- 'read' | 'create' | 'update' | 'delete'
  entity_type     text not null,       -- 'subject' | 'study' | ...
  entity_id       text not null,
  occurred_at     timestamptz not null default now(),
  diff            jsonb
);

create index idx_subjects_study on subjects(study_id);
create index idx_subject_visits_subject on subject_visits(subject_id);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
