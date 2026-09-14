# Mind flow research — Phase 0 설계 문서

"심리검사 자동 판독" 단일 HTML 앱을 SSD_CBT 연구 운영 관리 도구("Mind flow research")로 확장하기 위한
Phase 0(명세) 산출물이다. 근거 문서는 다음 세 가지이며, 모든 설계 결정은 이 문서들로 추적 가능해야 한다.

| 파일 | 내용 |
|---|---|
| `../연구 공통 절차 SSD연구 적용.pptx` | 연구 공통 절차 원형 + SSD_CBT 적용 + "Mind flow 활용" 요구사항 23장 |
| `../설문지_ver1.1_260422_전체 취합본.pdf` | 인구통계학적 정보 문항 + 임상척도 7종 원문(PHQ-15/신체증상척도, SSD-12, BDI-II, BAI, ASI-3, WHOQOL-BREF, K-HAQ) |
| `../PHQ.docx` | 위 7종의 채점 기준·심각도 구간·절단점표 |

## 확정된 전제 (재질문 금지)

1. 피험자 데이터는 처음부터 **공유 백엔드**(Node.js + PostgreSQL)로 관리한다.
2. 문자·카카오톡·이음톡 **발송 자동화는 후속 단계**(Phase 6)로 미루고, 이번 범위는 문구·일정표
   **생성**까지다.
3. 신분증·통장사본·가족관계증명서 등 개인정보 파일은 **기존 보관 경로**에 그대로 두고, 앱은
   **메타데이터만** 관리한다(파일 자체 업로드·저장 없음).

## 문서 목록

| 문서 | 내용 |
|---|---|
| [`data-model.md`](./data-model.md) | study / arm / subject / visit / assessment 등 핵심 엔터티와 필드 정의 |
| [`message-templates.md`](./message-templates.md) | 안내 문자·리마인드·EMR 메모·결과보고서 전송 문구 템플릿 카탈로그 |
| [`assessment-config-plan.md`](./assessment-config-plan.md) | 기존 `config/assessments.json` 스키마를 7개 척도로 확장하는 설계안과 척도별 특이사항 |
| [`privacy-and-hosting.md`](./privacy-and-hosting.md) | 개인정보 취급 원칙, 접근통제, 호스팅에 대한 가정과 미확정 사항 |
| [`open-questions.md`](./open-questions.md) | Phase 1 착수 전 확인이 필요한 항목 모음 |

## Phase 0 완료 기준

- [x] study/피험자/방문 데이터 모델 정의
- [x] 문자·메모 템플릿 카탈로그 (PPTX 원문 인용 + 플레이스홀더 정의)
- [x] 척도 config 확장안 정리 (7종 특이사항 포함)
- [x] 개인정보·IRB 취급 원칙 초안
- [ ] 호스팅 방식 확정 — 사용자 확인 대기 (`open-questions.md` 참조)
- [ ] SSD-12 회상기간, ASI-3 하위척도, WHOQOL-BREF 도메인 변환식 — 임상 검토자 확인 대기
