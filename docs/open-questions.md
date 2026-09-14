# Phase 1 착수 전 확인 사항

Phase 0 설계 과정에서 두 소스 문서(PPTX, 설문지 PDF, PHQ.docx)만으로는 확정할 수 없었던 항목이다.
카테고리별로 누구에게 확인이 필요한지 표시했다.

## 사용자(연구팀 운영) 확인 필요

| # | 항목 | 문서 |
|---|---|---|
| 1 | 호스팅 방식 — 사내 온프레미스 서버 vs 국내 클라우드 관리형 VM | `privacy-and-hosting.md` §5 |
| 2 | `pi`(교수님) 역할의 접근 범위 — 피험자 PII 전체 열람 가능한지, 익명화된 인롤 현황·타임라인 수치만인지 | `data-model.md` §9, `privacy-and-hosting.md` §3 |
| 3 | 데이터 보관·파기 기간(IRB 서류 기준) | `privacy-and-hosting.md` §4 |
| 4 | 대조군 주간 디지털 교육자료의 실제 콘텐츠/문구 소스 | `message-templates.md` §4 |
| 5 | 결과보고서 카카오톡(피험자)/이음톡(교수님) 전송 문구의 정확한 포맷 (타 연구용, SSD_CBT는 비대상) | `message-templates.md` §8 |
| 6 | `pre_visit_intro` 문자(무작위 배정 안내 등)의 최종 문구 — PPTX엔 포함 요소만 있고 완성 문구 없음 | `message-templates.md` §1 |

## 임상 검토자 확인 필요 (척도 채점)

| # | 항목 | 문서 |
|---|---|---|
| 7 | SSD-12 회상기간(원문에 미기재 — PHQ-15와 같은 "지난 4주"인지) | `assessment-config-plan.md` §3 |
| 8 | ASI-3 하위척도(신체적/인지적/사회적 우려) 문항 매핑 | `assessment-config-plan.md` §3 |
| 9 | WHOQOL-BREF 도메인-문항 매핑, 역채점 문항 목록, 0–100 변환식 확정 | `assessment-config-plan.md` §3 |
| 10 | K-HAQ 총점 산출이 21문항 평균인지 합산인지(PHQ.docx 내 "총점범위 0–3"과 "더하면 총점"이라는 서술이 상충) | `assessment-config-plan.md` §3 |
| 11 | K-HAQ 하위요인 4개의 점수도 평균/합산 중 무엇인지 | `assessment-config-plan.md` §3 |
| 12 | BDI-II 9번(자살사고) 안전 경로의 위험 단계별 권고 동작 문구 — 기관 자살 위험 대응 지침에 맞춰 확정 | `assessment-config-plan.md` §3 (기존 PHQ-9 `safetyPathway.approvalPending`과 동일 성격) |

이 항목들은 `assessments.json`에 `clinicalApproval.status: "pending"`으로 반영하고, 확인되는 대로
값만 갱신하면 되도록 Phase 2 스키마를 설계한다(기존 PHQ-9/GAD-7과 동일한 패턴).
