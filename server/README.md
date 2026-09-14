# Mind flow research — 백엔드 (Phase 1)

`../docs/data-model.md`의 users / studies / arms / visit_definitions / subjects / subject_visits /
audit_logs를 구현한 Node.js(Express) + PostgreSQL 백엔드다.

> **검증 상태**: 이 코드는 node/npm/PostgreSQL이 설치되지 않은 환경에서 작성됐다.
> `npm install`, 마이그레이션 실행, 서버 기동을 한 번도 실행해 보지 못했으므로 문법 오류나
> 런타임 이슈가 있을 수 있다. 아래 절차대로 실행해 보고 에러가 나면 알려달라 — 바로 고치겠다.

## 실행 방법

```bash
cd server
cp .env.example .env
# .env의 JWT_SECRET, ENCRYPTION_KEY를 채운다 (ENCRYPTION_KEY 생성 예시는 .env.example 참고)

npm install
docker compose up -d       # 로컬 PostgreSQL (또는 이미 떠 있는 Postgres를 DATABASE_URL로 지정)
npm run migrate            # migrations/001_init.sql 적용
npm run seed                # 관리자 계정 + SSD_CBT 연구/군/방문정의 시드
npm start                   # http://localhost:3000
```

시드 후 로그인 계정: `admin@example.com` / `change-me` (반드시 나중에 비밀번호를 바꿀 것).

서버가 뜨면 `http://localhost:3000` 이 곧 웹앱이다 — `public/index.html`을 같은 Express 서버가
정적으로 서빙한다(별도 프런트엔드 서버 없음). "Mind flow research Web app 가안.docx" 항목
1~8을 그대로 구현했다: 연구 탭·모집현황(1) → 대상자 등록(2) → 환자 안내사항 생성(3) →
피험자 일정표 자동 생성·이미지 저장(4) → 사전/중간/사후/종결 척도결과 입력(5~7) → 결과지표
비교(8). 자세한 화면 구성은 `public/js/app.js` 상단 주석과 각 함수 옆 "문서 항목 N" 참조 표기를
따라가면 된다.

## API 개요

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | 공개 | `{email, password}` → JWT |
| GET | `/studies` | 로그인 | 연구 목록 |
| POST | `/studies` | admin | 연구 생성 |
| GET/PATCH | `/studies/:id` | 로그인 / admin+researcher | |
| GET/POST | `/studies/:id/arms` | 로그인 / admin+researcher | |
| GET/POST | `/studies/:id/visit-definitions` | 로그인 / admin+researcher | |
| GET/POST | `/studies/:studyId/subjects` | 로그인 / admin+researcher | 피험자 목록·인롤 |
| GET/PATCH | `/subjects/:id` | 로그인(PII는 admin/researcher만) | 피험자 상세, 조회 시 audit_logs 기록 |
| GET/POST | `/subjects/:subjectId/visits` | 로그인 / admin+researcher | POST는 upsert(같은 방문 재요청 시 예정일만 갱신) |
| PATCH | `/visits/:id` | admin+researcher | |
| GET | `/visits/:visitId/assessment-responses` | 로그인 | 한 방문의 척도결과 전체 |
| PUT | `/visits/:visitId/assessment-responses/:assessmentId` | admin+researcher | 척도결과 저장(클라이언트가 채점 후 전송) |
| GET | `/subjects/:subjectId/assessment-responses` | 로그인 | 결과지표 비교 탭용, 전체 방문 결과 |

`pi`(교수님) 역할은 `subjects` 응답에서 PII(이름·연락처·인구통계·병력·개인정보 파일 메타데이터)가
자동으로 제거된다(`src/routes/subjects.js`의 `toSubjectResponse`). 이 범위가 맞는지는
`../docs/open-questions.md` #2 확인 후 조정한다.

## 척도 config

`public/assessments-ssd.json`에 PHQ-15·SSD-12·BDI-II·BAI·ASI-3·WHOQOL-BREF·K-HAQ 7종을
`설문지_ver1.1_260422_전체 취합본.pdf`(문항 원문) + `PHQ.docx`(채점 기준) 그대로 옮겨 담았다.
`clinicalApproval.status: "pending"` — WHOQOL-BREF 도메인 매핑, ASI-3 하위척도, K-HAQ 평균/합산
여부, SSD-12 회상기간은 `../docs/open-questions.md`의 임상 검토자 확인 항목과 동일하다.
채점은 `public/js/assessment-engine.js`가 이 JSON을 읽어 브라우저에서 계산하고, 결과만
`assessment_responses`(마이그레이션 002)에 저장한다 — 서버는 재검증하지 않는다(내부 연구원
전용 도구라는 전제).

## 이번 범위에서 의도적으로 빼놓은 것

- `CodingRecord`, `MessageLog`, `EmrMemoLog` 테이블/라우트 — Phase 5·4에서 추가 (`../docs/README.md` 로드맵 참고)
- 파일 업로드 — 결정 #3에 따라 앱이 파일을 저장하지 않으므로 없음
- 문자/카카오톡/이음톡 실제 발송 — 결정 #2에 따라 Phase 6 이전엔 구현하지 않음. 이번에 만든
  "환자 안내사항" 탭은 문구를 만들어 복사하는 것까지만 한다.
- 결과보고서 워드 저장은 HTML을 `application/msword` MIME으로 내려받는 방식(정식 .docx 생성 라이브러리
  아님) — Word에서는 열리지만 서식이 제한적이다. 엑셀 추출도 진짜 .xlsx가 아니라 CSV다(외부
  라이브러리 의존성을 피하기 위한 선택 — 두 방식 다 관련 프로그램에서 문제없이 열린다).
- 서버 측 척도 재채점/검증 없음(§척도 config 참고)
