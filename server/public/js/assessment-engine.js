// server/public/assessments-ssd.json을 읽어 문항 렌더링과 채점을 둘 다 지원하는 공용 엔진.
// docs/assessment-config-plan.md의 설계를 그대로 코드화한다 — 여기 없는 새 규칙을 추가하려면
// 그 문서도 같이 갱신할 것.

let _configPromise = null;

function loadAssessmentConfig() {
  if (!_configPromise) {
    _configPromise = fetch('/assessments-ssd.json').then((r) => {
      if (!r.ok) throw new Error('assessments-ssd.json 로드 실패');
      return r.json();
    });
  }
  return _configPromise;
}

/** 문항에 적용할 응답 선택지를 반환한다. BDI-II처럼 문항별 options가 있으면 그것을,
 *  없으면 문항의 responseGroup(WHOQOL) 또는 척도 전체 responseGroup을 찾는다. */
function resolveItemOptions(config, assessment, item) {
  if (item.options) return item.options;
  const groupKey = item.responseGroup || assessment.responseGroup;
  return config.responseGroups[groupKey] || [];
}

/** itemResponses: { "1": 2, "2": 0, ... } (문항 번호 문자열 → 선택값) */
function scoreAssessment(config, assessmentId, itemResponses) {
  const assessment = config.assessments[assessmentId];
  if (!assessment) throw new Error(`알 수 없는 척도: ${assessmentId}`);

  const missing = assessment.items
    .map((it) => it.number)
    .filter((n) => itemResponses[n] === undefined || itemResponses[n] === null);

  const result = {
    assessmentId, itemResponses, missing, totalScore: null, severityKey: null,
    domainScores: null, safetyFlag: null, interpretation: null,
  };

  if (assessment.scoring.method === 'domain_transform') {
    // WHOQOL-BREF: 총점이 없고 도메인별 0-100 점수만 있다. 도메인에 걸리지 않는 1,2번은
    // 참고용으로 원 응답값만 남긴다.
    result.domainScores = {};
    for (const domain of assessment.domains) {
      const values = domain.items.map((n) => {
        const raw = itemResponses[n];
        if (raw === undefined || raw === null) return null;
        return domain.reverseItems.includes(n) ? 6 - raw : raw; // (6 - x): 1-5 척도 역채점
      });
      if (values.some((v) => v === null)) { result.domainScores[domain.key] = null; continue; }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const rawScore = mean * 4; // 4-20
      result.domainScores[domain.key] = Math.round(((rawScore - 4) * (100 / 16)) * 10) / 10;
    }
    result.overallQol = itemResponses[1] ?? null;
    result.overallHealthSatisfaction = itemResponses[2] ?? null;
    return result;
  }

  if (missing.length > 0) return result; // 판독 불가 — totalScore는 null로 둔다

  const values = assessment.items.map((it) => itemResponses[it.number]);
  const sum = values.reduce((a, b) => a + b, 0);
  const total = assessment.scoring.method === 'mean' ? sum / assessment.items.length : sum;
  result.totalScore = Math.round(total * 100) / 100;

  const band = (assessment.severityBands || []).find(
    (b) => result.totalScore >= b.min && result.totalScore <= b.max
  );
  if (band) {
    result.severityKey = band.key;
    const tmpl = assessment.interpretationTemplates && assessment.interpretationTemplates[band.key];
    if (tmpl) result.interpretation = tmpl.replace('{total}', String(result.totalScore));
  } else if (assessment.interpretationTemplates && assessment.interpretationTemplates.default) {
    result.interpretation = assessment.interpretationTemplates.default.replace('{total}', String(result.totalScore));
  }

  if (assessment.safetyPathway) {
    const sp = assessment.safetyPathway;
    const itemValue = itemResponses[sp.itemNumber];
    if (itemValue === undefined || itemValue === null) {
      result.safetyFlag = { triggered: false, message: sp.missingItemMessage };
    } else if (itemValue >= sp.triggerValue) {
      const level = sp.levels.find((l) => l.itemValue === itemValue);
      const item = assessment.items.find((it) => it.number === sp.itemNumber);
      const options = resolveItemOptions(config, assessment, item);
      const itemLabel = (options.find((o) => o.value === itemValue) || {}).label || '';
      result.safetyFlag = {
        triggered: true,
        riskKey: level && level.riskKey,
        riskLabel: level && level.riskLabel,
        action: level && level.action,
        banner: sp.bannerTemplate.replace('{itemValue}', itemValue).replace('{itemLabel}', itemLabel),
      };
      if (sp.suppressNormalLabel) result.severityKey = result.severityKey; // 배너가 최상단에 우선 노출됨(렌더링 책임은 UI)
    } else {
      result.safetyFlag = { triggered: false };
    }
  }

  return result;
}

window.AssessmentEngine = { loadAssessmentConfig, resolveItemOptions, scoreAssessment };
