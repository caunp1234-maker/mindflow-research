// 스키마가 실제 SSD_CBT 연구 데이터를 받아낼 수 있는지 확인하기 위한 시드 스크립트.
// 관리자 계정 1개 + SSD_CBT 연구 + 군(arm) 2개 + 방문 정의 4개를 생성한다.
// 출처: docs/message-templates.md, docs/assessment-config-plan.md, PPTX 슬라이드 6·13-19.
//
// 주의: targetN·inclusionCriteria·exclusionCriteria·precautions는 IRB 서류 없이는 채울 수
// 없어 비워 둔다(docs/open-questions.md 대상 아님 — 이건 애초에 이번 세션이 참고한 두 문서
// 밖의 정보라 빈 값으로 둔 것). 방문별 assessmentIds도 PPTX에 "임상척도 실시"라고만 돼 있고
// 방문별로 7종 중 무엇을 시행하는지 명시돼 있지 않아, 우선 7종 전체를 넣어둔 가정값이다.
//
// 실행: npm run seed (마이그레이션 먼저 실행돼 있어야 함)

const bcrypt = require('bcryptjs');
const db = require('../src/db');

const ASSESSMENT_INTRO_TEXT = `연구 참여 과정에서 현재의 신체 증상, 기분 및 불안, 건강에 대한 걱정, 삶의 질 등을 알아보기 위한 여러 설문검사를 시행합니다. 각 검사는 현재 상태를 파악하고 치료 또는 교육 프로그램 참여 전후의 변화를 확인하기 위한 목적으로 사용됩니다.
- PHQ-15: 현재 경험하고 있는 신체 증상의 정도를 평가합니다.
- SSD-12: 신체 증상과 관련된 생각, 감정 및 행동 특성을 평가합니다.
- BDI-II: 우울 증상의 정도를 평가합니다.
- BAI: 불안 증상의 정도를 평가합니다.
- ASI-3: 불안으로 인해 나타나는 신체적·심리적 감각에 대한 민감성을 평가합니다.
- WHOQOL-BREF: 신체적·심리적 건강, 사회적 관계 및 생활환경 등을 포함한 전반적인 삶의 질을 평가합니다.
- K-HAQ: 건강에 대한 걱정이나 염려의 정도를 평가합니다.
각 설문은 정답이 있는 검사가 아니며, 현재 자신의 상태에 가장 가까운 응답을 선택하시면 됩니다. 설문 결과는 연구 참여 전후의 증상 및 삶의 질 변화를 확인하고, 인지행동치료의 효과를 평가하기 위한 연구자료로 활용됩니다.
연구 종료 후에는 연구와 관련하여 시행한 검사 결과를 참여자가 이해하기 쉽도록 해석 및 설명과 함께 제공할 예정입니다. 연구 결과는 참여자의 개인정보가 확인되지 않도록 처리하여 연구 목적으로 활용됩니다.`;

const ALL_ASSESSMENT_IDS = ['phq15', 'ssd12', 'bdi2', 'bai', 'asi3', 'whoqol_bref', 'khaq'];

async function main() {
  await db.withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash('change-me', 10);
    await client.query(
      `insert into users (name, email, password_hash, role)
       values ('관리자', 'admin@example.com', $1, 'admin')
       on conflict (email) do nothing`,
      [passwordHash]
    );

    await client.query(
      `insert into studies
         (id, title, status, report_generation_enabled, assessment_intro_text)
       values ($1,$2,'recruiting', false, $3)
       on conflict (id) do update set title = excluded.title`,
      ['ssd_cbt', '신체증상장애 환자를 위한 인지행동치료의 효과성 검증: 무작위 대조 연구', ASSESSMENT_INTRO_TEXT]
    );

    await client.query(
      `insert into arms (study_id, key, label, intervention_type, intervention_frequency)
       values
         ('ssd_cbt','intervention','실험군','인지행동치료(대면)','주 1회'),
         ('ssd_cbt','control','대조군','디지털 교육자료(비대면, 카카오톡)','주 1회')
       on conflict (study_id, key) do nothing`
    );

    const visitDefinitions = [
      { key: 'baseline', label: '사전평가', weekOffset: 0, procedures: ['임상척도', 'fNIRS'], medCheck: false },
      { key: 'week6', label: '중간평가', weekOffset: 6, procedures: ['임상척도'], medCheck: true },
      { key: 'week11', label: '사후평가', weekOffset: 11, procedures: ['임상척도', 'fNIRS'], medCheck: true },
      { key: 'week23', label: '추적평가', weekOffset: 23, procedures: ['임상척도'], medCheck: false },
    ];
    for (const v of visitDefinitions) {
      await client.query(
        `insert into visit_definitions
           (study_id, key, label, week_offset, duration_minutes, procedures, assessment_ids, medication_check_required)
         values ('ssd_cbt',$1,$2,$3,40,$4,$5,$6)
         on conflict (study_id, key) do nothing`,
        [v.key, v.label, v.weekOffset, v.procedures, ALL_ASSESSMENT_IDS, v.medCheck]
      );
    }
  });

  console.log('seed 완료: admin@example.com / change-me, study "ssd_cbt"');
  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
