# 데이터 모델

PPTX의 "연구 공통 절차"(슬라이드 5) 8단계와 SSD_CBT 적용(슬라이드 6–20)을 근거로 도출한 핵심 엔터티다.
표기 규칙: `PK` 기본키, `FK` 외래키, `Enc` 암호화 컬럼(개인정보), 괄호는 근거 슬라이드/문서.

## 1. Study (연구)

연구 공통 절차 슬라이드 5·21의 "연구별 선정/제외 기준 · 목표 N수 · 유의사항"을 담는 단위.

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | 연구 식별자 (예: `ssd_cbt`) |
| `title` | string | 연구 제목 ("신체증상장애 환자를 위한 인지행동치료의 효과성 검증: 무작위 대조 연구") |
| `irbApprovalNo` | string | IRB 승인번호 |
| `status` | enum | `recruiting` \| `active` \| `closed` |
| `inclusionCriteria` / `exclusionCriteria` | string[] | 선정/제외 기준 (슬라이드 21) |
| `targetN` | int | 목표 N수 (슬라이드 21, 23) |
| `precautions` | string[] | 유의사항, 예: "약물변경 금지" (슬라이드 21) |
| `arms` | Arm[] | 군 정의 |
| `visitScheduleTemplateId` | FK | 방문 일정 템플릿 |
| `assessmentSetId` | FK | 이 연구에서 사용하는 척도 세트 (config의 `order` 서브셋) |
| `reportGenerationEnabled` | bool | 결과보고서 자동 생성 대상 여부 — **SSD_CBT는 `false`**(슬라이드 20: "본 연구는 현재 결과보고서 별도 제작 X") |
| `deadline` | date? | 모집 마감일 (슬라이드 23) |

## 2. Arm (군)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | |
| `studyId` | FK | |
| `key` | enum | `intervention`(실험군) \| `control`(대조군) |
| `label` | string | 표시용 라벨 |
| `interventionType` | string | 실험군: "인지행동치료(대면)", 대조군: "디지털 교육자료(비대면, 카카오톡)" (슬라이드 16) |
| `interventionFrequency` | string | "주 1회" (슬라이드 16) |

## 3. VisitScheduleTemplate / VisitDefinition (방문 일정 템플릿)

슬라이드 6·13·14·17–19의 방문 구조를 그대로 모델링. `weekOffset`은 동의서 작성일(V1) 기준 주차.

| 필드 | 타입 | 설명 |
|---|---|---|
| `key` | string | `baseline`(사전평가) \| `week6`(중간평가) \| `week11`(사후평가) \| `week23`(추적평가) |
| `label` | string | 화면 표시용 |
| `weekOffset` | int | 0 / 6 / 11 / 23 |
| `durationMinutes` | int | 40 (슬라이드 13,17,18,19) |
| `procedures` | string[] | 예: `["임상척도", "fNIRS"]` — 방문별로 다름(사전·사후는 fNIRS 포함, 중간·추적은 임상척도만) |
| `assessmentIds` | string[] | 이 방문에서 시행하는 척도 id 목록 |
| `medicationCheckRequired` | bool | 중간/사후/추적 평가에서 "복용약물 변경 여부 확인" (슬라이드 17,18) |
| `instructionCardId` | FK | 방문별 환자 안내사항 카드(슬라이드 10: "임상척도 무엇을 평가하는지 / fNIRS 유의사항") |

SSD_CBT 기본 템플릿: `baseline(0주,fNIRS+임상척도) → week6(중간,임상척도만) → week11(사후,fNIRS+임상척도) → week23(추적,임상척도만)`.
개입 기간(11주)은 방문이 아니라 Arm의 `interventionFrequency`로 별도 관리(주 1회 CBT 또는 교육자료).

## 4. Subject (피험자)

슬라이드 2·6·12의 표지·인구통계 정보 + PDF 2쪽 인구통계학적 정보 문항 반영.
**개인정보 최소화**: PDF 표지가 "스크리닝 번호 + 대상자 이니셜"만 쓰는 것과 동일하게, 코딩·내보내기 결과물은
기본적으로 `screeningNumber`/`initials`만 노출하고 이름·연락처는 별도 접근 권한이 있는 화면에서만 조회한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | |
| `studyId` | FK | |
| `screeningNumber` | string | PDF 표지 "스크리닝 번호" |
| `initials` | string | PDF 표지 "대상자 이니셜" |
| `name` | Enc string | 실명 (접근 제한) |
| `contactPhone` | Enc string | 문자 발송용 연락처(슬라이드 6–8) — 이번 범위에선 "생성"까지만 쓰이지만 필드는 필요 |
| `armId` | FK? | 무작위 배정 결과, 배정 전 null(슬라이드 6: "1) 연구 안내(무작위 배정)") |
| `randomizedAt` | datetime? | |
| `enrollmentStatus` | enum | `screening` → `enrolled` → `in_intervention` → `completed` \| `withdrawn` |
| `consentDate` | date? | 동의서 작성일 = V1 일자 (슬라이드 9, EMR 메모 포맷의 "YYMMDD") |
| `demographics` | jsonb | PDF 2쪽 필드 일체: 생년월일, 연령, 성별, 결혼상태, 학력, 교육연한, 직업, 가구 월평균 소득 |
| `medicalHistory` | jsonb | 병력(슬라이드 11: "환자 구두 질문, EMR 확인") |
| `medicationLog` | MedicationEntry[] | 최초 조사 + 방문별 변경 여부 기록(슬라이드 17,18) |
| `idDocRef` | IdDocRef | §5 참조 — 메타데이터만 |
| `withdrawalReason` | string? | |

### 4-1. IdDocRef (개인정보 파일 메타데이터 — 파일 자체는 저장하지 않음)

슬라이드 12: "(필요시) 신분증&통장사본&가족관계증명서(미성년자) 제출". **결정 #3에 따라 파일은
기존 보관 경로에 남기고, 앱은 아래 메타데이터만 가진다.**

| 필드 | 타입 | 설명 |
|---|---|---|
| `docType` | enum | `id_card` \| `bankbook` \| `family_relation_cert` |
| `required` | bool | 미성년자 등 해당 시에만 `family_relation_cert` 필요 |
| `submitted` | bool | |
| `submittedAt` | date? | |
| `storageRef` | string | 파일이 실제 보관된 경로/위치에 대한 설명 텍스트 (앱이 열람 링크를 제공하지 않음) |

## 5. SubjectVisit (피험자별 방문)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | |
| `subjectId` | FK | |
| `visitDefinitionKey` | FK | |
| `scheduledDate` | date | 일정표 자동 생성 결과(슬라이드 14) |
| `actualDate` | date? | |
| `status` | enum | `scheduled` \| `completed` \| `no_show` \| `cancelled` |
| `medicationChangeNoted` | bool? | |
| `notes` | text? | |

## 6. AssessmentResponse (척도 응답/채점 결과)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | |
| `subjectVisitId` | FK | |
| `assessmentId` | string | `phq15` \| `ssd12` \| `bdi2` \| `bai` \| `asi3` \| `whoqol_bref` \| `khaq` (기존 `phq9`/`gad7`과 동일 네임스페이스) |
| `itemResponses` | jsonb | 문항별 원 응답값 |
| `totalScore` | number? | 채점 결과 — 판독 불가 시 null |
| `severityKey` | string? | |
| `prorated` | bool | |
| `safetyFlag` | jsonb? | BDI-II 9번 문항 등 안전 경로 결과 |
| `computedAt` | datetime | |

이 테이블은 기존 config 주도 판독 엔진(`config/assessments.json`)의 출력을 그대로 저장하는 구조로,
Phase 2에서 엔진을 확장하면 스키마 변경 없이 7종 모두 수용 가능하다.

## 7. CodingRecord / ReportRecord

슬라이드 4·20의 "코딩"·"결과보고서" 단계. `Study.reportGenerationEnabled`가 `true`인 연구에서만
`ReportRecord`가 생성된다(SSD_CBT는 해당 없음, 슬라이드 20).

| 필드 | 타입 | 설명 |
|---|---|---|
| `CodingRecord.subjectId/visitId` | FK | 인구통계+병력/약물+척도 합계를 한 행으로 묶은 내보내기용 뷰 |
| `ReportRecord.reportPdfRef` | string | 생성된 보고서 참조(파일은 §5와 동일하게 메타데이터 원칙 적용 검토) |
| `ReportRecord.sentToSubjectAt` / `sentToProfessorAt` | datetime? | 카톡/이음톡 "생성" 시점 기록 — 실제 발송은 Phase 6 |

## 8. MessageLog / EmrMemoLog

`message-templates.md`의 템플릿을 피험자/일정과 병합해 생성한 결과를 감사 목적으로 남긴다.
이번 범위는 "생성"까지이므로 `sentAt`은 항상 null이며, Phase 6에서 발송 어댑터가 채운다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | PK | |
| `subjectId` | FK | |
| `templateKey` | string | `message-templates.md` 참조 |
| `mergedText` | text | 생성된 최종 문구 |
| `generatedAt` | datetime | |
| `generatedByUserId` | FK | |
| `sentAt` | datetime? | Phase 6 이전에는 항상 null |

## 9. User / Role / AuditLog

슬라이드 21–23 "교수님께 공유"는 읽기 전용 대시보드(인롤 현황·타임라인)이며, PII 전체 접근은
연구원 역할로 제한하는 것을 기본 가정으로 한다(확정 필요 — `open-questions.md`).

| 엔터티 | 필드 | 설명 |
|---|---|---|
| `User` | `id, name, email, role` | `role`: `researcher` \| `pi`(교수님) \| `admin` |
| `AuditLog` | `id, actorUserId, action, entityType, entityId, occurredAt, diff` | 모든 PII 조회/수정 기록 |
