// "Mind flow research Web app 가안.docx" §3의 문구를 그대로 옮긴 템플릿.
// ORG_NAME과 LOCATION은 문서 원문 그대로다. LOCATION은 "광명역 M클러스터"와
// "다온심리상담센터" 주소가 함께 적혀 있어 실제 배포 전에 연구팀 확인이 필요해 보인다 —
// 확인되면 이 두 상수만 고치면 된다.
const Templates = (() => {
  const ORG_NAME = '중앙대학교광명병원 정신건강의학과 연구팀';
  const LOCATION = '광명역 M클러스터\n(경기도 광명시 덕안로 104번길 17 609호 다온심리상담센터)';
  const DURATION_TEXT = '약 40분간 동의서 안내 및 사전평가가 진행될 예정입니다.';

  const FNIRS_TEXT = `-fNIRS(기능성 근적외선분광기) 검사
fNIRS는 머리에 장비를 착용하여 뇌의 활동 변화를 확인하는 비침습적인 검사입니다. 피부와 두개골을 통과할 수 있는 약한 근적외선을 이용하여 전두엽의 혈액량 변화를 측정합니다.
본 연구에서는 약 3분간 fNIRS 검사를 시행합니다. 검사를 통해 전두엽의 뇌활동이 어떻게 변화하는지를 확인하고, 이러한 뇌활동의 변화가 신체증상 및 기분증상의 변화와 어떠한 관련이 있는지를 살펴보고자 합니다.
검사는 주사나 방사선 노출 없이 진행되며, 검사 중 특별한 통증은 없습니다. 측정된 자료는 연구 목적에 한하여 분석됩니다.`;

  function formatDateTimeKorean(dateStr) {
    if (!dateStr) return '0000년 0월 0일 (요일) 00시';
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}시`;
  }

  /** 1) 환자 안내 문구 (등록 확정 문자) */
  function buildInviteMessage({ scheduledDateTime }) {
    return `[${ORG_NAME}]
안녕하세요. 임상시험 참여가 확정되어 안내드립니다.

*진행일시: ${formatDateTimeKorean(scheduledDateTime)}
*방문장소: ${LOCATION}
*진행절차: ${DURATION_TEXT} 감사합니다.`;
  }

  /** 2) 사전평가 시 진행되는 절차의 안내 = 임상척도 설명(연구별 assessmentIntroText) + fNIRS 설명 */
  function buildProcedureInfo(assessmentIntroText) {
    return `${assessmentIntroText || ''}\n\n${FNIRS_TEXT}`;
  }

  return { ORG_NAME, LOCATION, buildInviteMessage, buildProcedureInfo, formatDateTimeKorean };
})();
