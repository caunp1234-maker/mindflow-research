// Mind flow research 웹앱 — "Mind flow research Web app 가안.docx" 항목 1~8 구현.
// 프레임워크 없이 순수 DOM/fetch로 작성했다(내부 연구 도구, 빌드 없이 바로 서빙).

const STUDY_ID = 'ssd_cbt'; // 문서 항목1: "현재 Tab은 SSD_CBT연구로" — 다른 연구는 추후 탭 추가

const state = {
  config: null, // assessments-ssd.json
  study: null, arms: [], visitDefs: [], subjects: [],
  selectedSubjectId: null, selectedSubject: null, selectedVisits: [],
  selectedResponses: [], // assessment_responses of the current score-entry visit
  detailTab: 'basic',
  scoreVisitKey: null,
};

function qs(sel, root) { return (root || document).querySelector(sel); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function maskName(name) {
  if (!name) return '';
  const chars = [...name];
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { const orig = btn.textContent; btn.textContent = '복사됨'; setTimeout(() => (btn.textContent = orig), 1200); }
  } catch (e) {
    alert('클립보드 복사에 실패했습니다. 텍스트를 직접 선택해 복사해 주세요.');
  }
}

// ── 부팅 ─────────────────────────────────────────────────────────────
async function boot() {
  state.config = await AssessmentEngine.loadAssessmentConfig();
  if (Api.token()) {
    try { await loadStudyDashboard(); showApp(); }
    catch (e) { Api.clearSession(); showLogin(); }
  } else {
    showLogin();
  }
}

function showLogin() {
  qs('#login-view').classList.remove('hidden');
  qs('#app-view').classList.add('hidden');
}
function showApp() {
  qs('#login-view').classList.add('hidden');
  qs('#app-view').classList.remove('hidden');
}

qs('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = qs('#login-email').value.trim();
  const password = qs('#login-password').value;
  const errEl = qs('#login-error');
  errEl.textContent = '';
  try {
    const { token, role } = await Api.login(email, password);
    Api.setSession(token, role);
    await loadStudyDashboard();
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

qs('#logout-btn').addEventListener('click', () => { Api.clearSession(); location.reload(); });

// ── 연구 대시보드 (문서 항목 1) ─────────────────────────────────────
async function loadStudyDashboard() {
  const [study, arms, visitDefs, subjects] = await Promise.all([
    Api.getStudy(STUDY_ID), Api.listArms(STUDY_ID), Api.listVisitDefinitions(STUDY_ID), Api.listSubjects(STUDY_ID),
  ]);
  state.study = study; state.arms = arms; state.visitDefs = visitDefs.sort((a, b) => a.weekOffset - b.weekOffset);
  state.subjects = subjects;
  qs('#role-label').textContent = Api.role() === 'pi' ? '교수님(읽기 전용)' : Api.role();
  renderDashboard();
}

function renderDashboard() {
  const s = state.study;
  // 문서 항목1: "연구명으로 Tab 분류(현재 Tab은 SSD_CBT연구로)" — 연구 제목이 길어 탭에는
  // 짧은 코드명을 쓴다. 다른 연구가 추가되면 이 탭 목록도 늘어난다.
  qs('#study-tabs').innerHTML = `<button class="active">SSD_CBT</button>`;
  qs('#study-header').innerHTML = `
    <h2>${esc(s.title)}</h2>
    <div class="stats">
      <span>모집 현황: <b>${state.subjects.length}${s.targetN ? ` / ${s.targetN}` : ''}</b>명</span>
      <span>상태: <b>${esc(s.status)}</b></span>
      <span>마감일: <b>${s.deadline ? fmtDate(s.deadline) : '미정'}</b></span>
    </div>`;
  renderSubjectList();
}

function renderSubjectList() {
  const readOnly = Api.role() === 'pi';
  qs('#subject-list-panel').innerHTML = `
    <div class="panel-head">
      <h3>대상자 목록</h3>
      ${readOnly ? '' : '<button class="btn-primary" id="open-register">+ 대상자 등록</button>'}
    </div>
    <table class="subject-table">
      <thead><tr><th>스크리닝번호</th><th>이름</th><th>군</th><th>상태</th><th>등록일</th></tr></thead>
      <tbody>
        ${state.subjects.map((s) => `
          <tr data-id="${s.id}">
            <td>${esc(s.screeningNumber)}</td>
            <td>${esc(s.name ? maskName(s.name) : s.initials)}</td>
            <td>${armBadge(s.armId)}</td>
            <td><span class="badge">${esc(s.enrollmentStatus)}</span></td>
            <td>${fmtDate(s.consentDate)}</td>
          </tr>`).join('') || `<tr><td colspan="5" style="color:var(--ink-faint)">등록된 대상자가 없습니다.</td></tr>`}
      </tbody>
    </table>`;
  if (!readOnly) qs('#open-register').addEventListener('click', openRegisterModal);
  qs('#subject-list-panel').querySelectorAll('tbody tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => selectSubject(tr.dataset.id));
  });
}

function armBadge(armId) {
  const arm = state.arms.find((a) => a.id === armId);
  if (!arm) return '<span class="badge">미배정</span>';
  return `<span class="badge arm-${esc(arm.key)}">${esc(arm.label)}</span>`;
}

// ── 대상자 등록 (문서 항목 2) ────────────────────────────────────────
function openRegisterModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>대상자 등록</h3>
      <form id="register-form">
        <div class="form-grid">
          <label>환자 성명</label><input name="name" required />
          <label>성별/나이</label><input name="genderAge" placeholder="예: 여/34" />
          <label>생년월일</label><input name="birthDate" type="date" />
          <label>등록 일자</label><input name="consentDate" type="date" required />
          <label>주치의</label><input name="doctorName" />
          <label>무작위 배정 결과</label>
          <select name="armKey">
            <option value="">미배정</option>
            ${state.arms.map((a) => `<option value="${esc(a.key)}">${esc(a.label)}</option>`).join('')}
          </select>
        </div>
        <div class="error-text" id="register-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="register-cancel">취소</button>
          <button type="submit" class="btn-primary">등록</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(backdrop);
  qs('#register-cancel', backdrop).addEventListener('click', () => backdrop.remove());
  qs('#register-form', backdrop).addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) return;
    const arm = state.arms.find((a) => a.key === fd.get('armKey'));
    const screeningNumber = `SSD-${String(state.subjects.length + 1).padStart(3, '0')}`;
    try {
      const subject = await Api.createSubject(STUDY_ID, {
        screeningNumber,
        initials: maskName(name),
        name,
        armId: arm ? arm.id : null,
        consentDate: fd.get('consentDate') || null,
        demographics: {
          genderAge: fd.get('genderAge') || null,
          birthDate: fd.get('birthDate') || null,
          doctorName: fd.get('doctorName') || null,
        },
      });
      backdrop.remove();
      await loadStudyDashboard();
      selectSubject(subject.id);
    } catch (err) {
      qs('#register-error', backdrop).textContent = err.message;
    }
  });
}

// ── 대상자 상세 ───────────────────────────────────────────────────────
async function selectSubject(id) {
  state.selectedSubjectId = id;
  state.detailTab = 'basic';
  const [subject, visits] = await Promise.all([Api.getSubject(id), Api.listVisits(id)]);
  state.selectedSubject = subject;
  state.selectedVisits = visits;
  renderSubjectDetail();
  qs('#subject-detail-panel').scrollIntoView({ behavior: 'smooth' });
}

function visitFor(key) {
  const def = state.visitDefs.find((d) => d.key === key);
  if (!def) return null;
  const visit = state.selectedVisits.find((v) => v.visitDefinitionId === def.id);
  return { def, visit };
}

function renderSubjectDetail() {
  const panel = qs('#subject-detail-panel');
  if (!state.selectedSubjectId) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const tabs = [
    ['basic', '기본정보'], ['notice', '환자 안내사항'], ['schedule', '피험자 일정표'],
    ['scores', '척도결과 입력'], ['compare', '결과지표 비교'],
  ];
  panel.innerHTML = `
    <div class="panel-head">
      <h3>피험자 상세 — ${esc(state.selectedSubject.screeningNumber)}</h3>
      <button class="btn-ghost" id="close-detail">← 목록으로</button>
    </div>
    <div class="subject-tabs">
      ${tabs.map(([k, l]) => `<button data-tab="${k}" class="${state.detailTab === k ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <div id="detail-body"></div>`;
  qs('#close-detail').addEventListener('click', () => { state.selectedSubjectId = null; renderSubjectDetail(); });
  panel.querySelectorAll('.subject-tabs button').forEach((b) => {
    b.addEventListener('click', () => { state.detailTab = b.dataset.tab; renderSubjectDetail(); });
  });
  const body = qs('#detail-body');
  if (state.detailTab === 'basic') renderBasicTab(body);
  else if (state.detailTab === 'notice') renderNoticeTab(body);
  else if (state.detailTab === 'schedule') renderScheduleTab(body);
  else if (state.detailTab === 'scores') renderScoresTab(body);
  else if (state.detailTab === 'compare') renderCompareTab(body);
}

// ── 기본정보 ──────────────────────────────────────────────────────────
function renderBasicTab(body) {
  const s = state.selectedSubject;
  const d = s.demographics || {};
  body.innerHTML = `
    <div class="panel">
      <dl class="kv-grid">
        <dt>환자 성명</dt><dd>${esc(s.name || '(비공개)')}</dd>
        <dt>성별/나이</dt><dd>${esc(d.genderAge || '-')}</dd>
        <dt>생년월일</dt><dd>${d.birthDate ? fmtDate(d.birthDate) : '-'}</dd>
        <dt>등록 일자</dt><dd>${fmtDate(s.consentDate)}</dd>
        <dt>주치의</dt><dd>${esc(d.doctorName || '-')}</dd>
        <dt>무작위 배정</dt><dd>${armBadge(s.armId)}</dd>
        <dt>등록 상태</dt><dd>${esc(s.enrollmentStatus)}</dd>
      </dl>
    </div>`;
}

// ── 환자 안내사항 (문서 항목 3) ──────────────────────────────────────
function renderNoticeTab(body) {
  const { visit } = visitFor('baseline') || {};
  const invite = Templates.buildInviteMessage({ scheduledDateTime: visit && visit.scheduledDate });
  const procedure = Templates.buildProcedureInfo(state.study.assessmentIntroText);
  body.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>1) 환자 안내 문구</h3><button class="btn-secondary copy-btn" data-copy="invite">복사</button></div>
      <pre class="template-text" id="tpl-invite">${esc(invite)}</pre>
      ${!visit ? '<p style="color:var(--ink-faint);font-size:.85rem">※ 사전평가 일정이 아직 생성되지 않아 진행일시가 비어 있습니다 — "피험자 일정표" 탭에서 먼저 생성하세요.</p>' : ''}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>2) 사전평가 시 진행되는 절차의 안내</h3><button class="btn-secondary copy-btn" data-copy="procedure">복사</button></div>
      <pre class="template-text" id="tpl-procedure">${esc(procedure)}</pre>
    </div>`;
  body.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyText(qs(`#tpl-${btn.dataset.copy}`).textContent, btn));
  });
}

// ── 피험자 일정표 (문서 항목 4) ──────────────────────────────────────
function renderScheduleTab(body) {
  const consentDate = state.selectedSubject.consentDate;
  body.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>피험자 일정표</h3>
        <div>
          <button class="btn-secondary" id="gen-schedule" ${consentDate ? '' : 'disabled'}>일정 생성/갱신</button>
          <button class="btn-secondary" id="save-schedule-image">이미지로 저장</button>
        </div>
      </div>
      ${consentDate ? '' : '<p style="color:var(--critical);font-size:.85rem">등록 일자가 없어 일정을 계산할 수 없습니다 — 기본정보에서 등록 일자를 먼저 입력하세요.</p>'}
      <table class="schedule-table" id="schedule-table">
        <thead><tr><th>방문</th><th>기준 주차</th><th>예정일</th><th>상태</th></tr></thead>
        <tbody>
          ${state.visitDefs.map((d) => {
            const v = state.selectedVisits.find((x) => x.visitDefinitionId === d.id);
            return `<tr><td>${esc(d.label)}</td><td>${d.weekOffset === 0 ? '등록일' : d.weekOffset + '주 후'}</td>
              <td>${v && v.scheduledDate ? fmtDate(v.scheduledDate) : '-'}</td><td>${v ? esc(v.status) : '미생성'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  qs('#gen-schedule').addEventListener('click', async () => {
    for (const d of state.visitDefs) {
      const scheduledDate = addDays(consentDate, d.weekOffset * 7);
      await Api.upsertVisit(state.selectedSubjectId, { visitDefinitionId: d.id, scheduledDate });
    }
    state.selectedVisits = await Api.listVisits(state.selectedSubjectId);
    renderScheduleTab(body);
  });
  qs('#save-schedule-image').addEventListener('click', () => exportScheduleImage());
}

function exportScheduleImage() {
  const rows = state.visitDefs.map((d) => {
    const v = state.selectedVisits.find((x) => x.visitDefinitionId === d.id);
    return [d.label, v && v.scheduledDate ? fmtDate(v.scheduledDate) : '-'];
  });
  const canvas = document.createElement('canvas');
  const width = 480, rowH = 44, headH = 90;
  canvas.width = width; canvas.height = headH + rowH * rows.length + 30;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1C2330'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`피험자 일정표 (${state.selectedSubject.screeningNumber})`, 20, 34);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#54606F';
  ctx.fillText(`등록일: ${fmtDate(state.selectedSubject.consentDate)}`, 20, 58);
  let y = headH;
  ctx.strokeStyle = '#DCDEE4';
  rows.forEach(([label, date]) => {
    ctx.strokeRect(20, y, width - 40, rowH);
    ctx.fillStyle = '#1C2330'; ctx.font = '14px sans-serif';
    ctx.fillText(label, 34, y + 27);
    ctx.fillText(date, width - 160, y + 27);
    y += rowH;
  });
  canvas.toBlob((blob) => downloadBlob(blob, `일정표_${state.selectedSubject.screeningNumber}.png`));
}

// ── 척도결과 입력 (문서 항목 5~7) ────────────────────────────────────
function renderScoresTab(body) {
  const scoreableVisits = state.visitDefs; // baseline/week6/week11/week23 전부 입력 가능하게 함
  if (!state.scoreVisitKey) state.scoreVisitKey = scoreableVisits[0] && scoreableVisits[0].key;
  body.innerHTML = `
    <div class="visit-picker">
      ${scoreableVisits.map((d) => `<button data-key="${d.key}" class="${state.scoreVisitKey === d.key ? 'active' : ''}">${esc(d.label)}</button>`).join('')}
    </div>
    <div id="score-body"></div>`;
  body.querySelectorAll('.visit-picker button').forEach((b) => {
    b.addEventListener('click', async () => { state.scoreVisitKey = b.dataset.key; await loadAndRenderScoreBody(); });
  });
  loadAndRenderScoreBody();

  async function loadAndRenderScoreBody() {
    const scoreBody = qs('#score-body');
    const { def, visit } = visitFor(state.scoreVisitKey) || {};
    body.querySelectorAll('.visit-picker button').forEach((b) => b.classList.toggle('active', b.dataset.key === state.scoreVisitKey));
    if (!def) { scoreBody.innerHTML = '<p>방문 정의가 없습니다.</p>'; return; }
    if (!visit) {
      scoreBody.innerHTML = `<p style="color:var(--critical)">이 방문의 일정이 아직 생성되지 않았습니다 — "피험자 일정표" 탭에서 먼저 생성하세요.</p>`;
      return;
    }
    state.selectedResponses = await Api.getVisitResponses(visit.id);
    scoreBody.innerHTML = `
      <div class="panel-head"><h3>${esc(def.label)} 척도결과</h3>
        <button class="btn-primary" id="gen-report">결과보고서 생성</button></div>
      <div id="assessment-forms"></div>`;
    qs('#gen-report').addEventListener('click', () => openReportView(def, visit));
    const formsEl = qs('#assessment-forms');
    def.assessmentIds.forEach((aid) => formsEl.appendChild(renderAssessmentCard(aid, visit)));
  }
}

function renderAssessmentCard(assessmentId, visit) {
  const config = state.config;
  const assessment = config.assessments[assessmentId];
  const existing = state.selectedResponses.find((r) => r.assessmentId === assessmentId);
  const savedItemResponses = (existing && existing.itemResponses) || {};

  const details = document.createElement('details');
  details.className = 'assessment-card';
  details.innerHTML = `
    <summary><span>${esc(assessment.name)} <span style="font-weight:400;color:var(--ink-faint)">— ${esc(assessment.fullName)}</span></span>
      <span id="summary-${assessmentId}">${summaryText(existing)}</span></summary>
    <div class="body">
      <p style="font-size:.85rem;color:var(--ink-soft)">${esc(assessment.instructionStem || '')}</p>
      <div class="items"></div>
      <div id="safety-${assessmentId}"></div>
      <div class="result-line incomplete" id="result-${assessmentId}">아직 계산되지 않았습니다.</div>
      <div style="margin-top:.8rem"><button class="btn-primary" data-save="${assessmentId}">저장</button></div>
    </div>`;
  const itemsEl = qs('.items', details);
  assessment.items.forEach((item) => {
    const options = AssessmentEngine.resolveItemOptions(config, assessment, item);
    const row = document.createElement('div');
    row.className = 'assessment-item';
    row.innerHTML = `
      <div class="qtext">${item.number}. ${esc(item.text)}</div>
      <div class="options">
        ${options.map((o, idx) => `
          <label>
            <input type="radio" name="${assessmentId}-item-${item.number}" value="${o.value}"
              ${Number(savedItemResponses[item.number]) === o.value && optionMatches(savedItemResponses, item.number, idx, options) ? 'checked' : ''} />
            ${esc(o.label)}
          </label>`).join('')}
      </div>`;
    itemsEl.appendChild(row);
  });

  qs(`[data-save="${assessmentId}"]`, details).addEventListener('click', async () => {
    const itemResponses = {};
    assessment.items.forEach((item) => {
      const checked = details.querySelector(`input[name="${assessmentId}-item-${item.number}"]:checked`);
      if (checked) itemResponses[item.number] = Number(checked.value);
    });
    const result = AssessmentEngine.scoreAssessment(config, assessmentId, itemResponses);
    renderResultLine(assessmentId, result, assessment);
    await Api.saveVisitResponse(visit.id, assessmentId, {
      itemResponses, totalScore: result.totalScore, severityKey: result.severityKey,
      domainScores: result.domainScores, safetyFlag: result.safetyFlag,
    });
    const idx = state.selectedResponses.findIndex((r) => r.assessmentId === assessmentId);
    const saved = { assessmentId, itemResponses, ...result };
    if (idx >= 0) state.selectedResponses[idx] = saved; else state.selectedResponses.push(saved);
    qs(`#summary-${assessmentId}`).textContent = summaryText(saved);
  });

  if (existing) {
    // 서버에는 interpretation 텍스트를 저장하지 않으므로(severityKey만 저장), 불러올 때 다시 만든다.
    if (!existing.interpretation && existing.severityKey && assessment.interpretationTemplates) {
      const tmpl = assessment.interpretationTemplates[existing.severityKey] || assessment.interpretationTemplates.default;
      if (tmpl) existing.interpretation = tmpl.replace('{total}', String(existing.totalScore));
    }
    renderResultLine(assessmentId, existing, assessment, details);
  }
  return details;
}
// BDI-II 16/18번처럼 같은 value를 가진 옵션이 여러 개일 때, 저장된 응답이 어느 라디오였는지까지는
// 구분해 복원하지 않는다(값만 같으면 됨 — 채점에는 영향 없음). 첫 번째 매칭 옵션만 체크 표시한다.
function optionMatches(savedItemResponses, itemNumber, idx, options) {
  const firstMatchIdx = options.findIndex((o) => o.value === Number(savedItemResponses[itemNumber]));
  return idx === firstMatchIdx;
}

function summaryText(r) {
  if (!r) return '미입력';
  if (r.domainScores) return '도메인 산출됨';
  if (r.totalScore === null || r.totalScore === undefined) return '미입력';
  return `총점 ${r.totalScore}`;
}

function renderResultLine(assessmentId, result, assessment, root) {
  root = root || document;
  const line = qs(`#result-${assessmentId}`, root);
  const safetyEl = qs(`#safety-${assessmentId}`, root);
  if (safetyEl) safetyEl.innerHTML = '';
  if (result.domainScores) {
    const rows = assessment.domains.map((d) => `${d.label} ${result.domainScores[d.key] ?? '-'}`).join(' · ');
    line.className = 'result-line'; line.textContent = rows;
  } else if (result.missing && result.missing.length > 0) {
    line.className = 'result-line incomplete';
    line.textContent = `미응답 문항: ${result.missing.join(', ')}`;
  } else {
    line.className = 'result-line';
    line.textContent = result.interpretation || `총점 ${result.totalScore}`;
    if (result.safetyFlag && result.safetyFlag.triggered && safetyEl) {
      safetyEl.innerHTML = `<div class="safety-banner">${esc(result.safetyFlag.banner)} — ${esc(result.safetyFlag.action || '')}</div>`;
    }
  }
}

// ── 결과보고서 (문서 항목 5~7: 결과보고서 생성 → 엑셀/워드) ─────────
function openReportView(visitDef, visit) {
  const s = state.selectedSubject;
  const config = state.config;
  const rows = visitDef.assessmentIds.map((aid) => {
    const a = config.assessments[aid];
    const r = state.selectedResponses.find((x) => x.assessmentId === aid);
    return { assessment: a, response: r };
  });
  const reportHtml = `
    <h1 style="font-size:20px">연구 결과보고서</h1>
    <p><b>연구명:</b> ${esc(state.study.title)}<br/>
       <b>성명:</b> ${esc(s.name || s.initials)} (${esc(s.screeningNumber)})<br/>
       <b>평가 시점:</b> ${esc(visitDef.label)} (${fmtDate(visit.scheduledDate)})</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
      <tr><th>척도</th><th>결과</th><th>해석</th></tr>
      ${rows.map(({ assessment, response }) => `
        <tr>
          <td>${esc(assessment.name)}</td>
          <td>${response ? (response.domainScores
            ? Object.entries(response.domainScores).map(([k, v]) => `${k}: ${v ?? '-'}`).join('<br/>')
            : (response.totalScore ?? '미입력')) : '미입력'}</td>
          <td>${response && response.interpretation ? esc(response.interpretation) : '-'}</td>
        </tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#54606F;margin-top:16px">
      본 결과는 연구 목적의 참고자료이며, 최종 해석과 진단은 반드시 자격을 갖춘 의료진의 임상적 평가를 통해 이루어져야 합니다.
      값이 pending 상태인 채점 기준이 포함되어 있을 수 있습니다(docs/assessment-config-plan.md 참고).
    </p>`;

  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>결과보고서 - ${esc(s.screeningNumber)}</title></head><body>${reportHtml}
    <div style="margin-top:20px">
      <button onclick="window.print()">인쇄</button>
    </div>
  </body></html>`);
  win.document.close();

  // 워드로 저장: HTML을 application/msword MIME으로 내려받는다(Word가 열 수 있는 표준적인 방식).
  const wordBlob = new Blob(
    [`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"></head><body>${reportHtml}</body></html>`],
    { type: 'application/msword' }
  );
  downloadBlob(wordBlob, `결과보고서_${s.screeningNumber}_${visitDef.key}.doc`);

  // 엑셀 추출: 문항별 원자료 + 총점을 CSV로.
  const csvLines = [['척도', '문항', '응답값', '총점/도메인', '해석'].join(',')];
  rows.forEach(({ assessment, response }) => {
    if (!response) { csvLines.push([assessment.name, '', '', '', '미입력'].join(',')); return; }
    Object.entries(response.itemResponses || {}).forEach(([itemNo, val]) => {
      csvLines.push([assessment.name, itemNo, val, '', ''].join(','));
    });
    const totalCell = response.domainScores
      ? Object.entries(response.domainScores).map(([k, v]) => `${k}:${v}`).join(';')
      : response.totalScore;
    csvLines.push([assessment.name, 'TOTAL', '', totalCell, (response.interpretation || '').replace(/,/g, ' ')].join(','));
  });
  downloadBlob(new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' }),
    `척도결과_${s.screeningNumber}_${visitDef.key}.csv`);
}

// ── 결과지표 비교 (문서 항목 8) ──────────────────────────────────────
async function renderCompareTab(body) {
  body.innerHTML = '<p>불러오는 중…</p>';
  const responses = await Api.getSubjectResponses(state.selectedSubjectId);
  const visitOrder = state.visitDefs.map((d) => d.key);
  const assessmentIds = [...new Set(responses.map((r) => r.assessmentId))];
  if (assessmentIds.length === 0) { body.innerHTML = '<p style="color:var(--ink-faint)">입력된 척도결과가 없습니다.</p>'; return; }

  body.innerHTML = `
    <div class="panel">
      <h3>사전 · 중간 · 사후 · 종결 결과지표 비교</h3>
      <table class="compare-table">
        <thead><tr><th>척도</th>${state.visitDefs.map((d) => `<th>${esc(d.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${assessmentIds.map((aid) => {
            const assessment = state.config.assessments[aid];
            return `<tr><td>${esc(assessment.name)}</td>${visitOrder.map((key) => {
              const r = responses.find((x) => x.assessmentId === aid && x.visitKey === key);
              if (!r) return '<td class="na">-</td>';
              if (r.domainScores) {
                return `<td>${Object.values(r.domainScores).map((v) => v ?? '-').join(' / ')}</td>`;
              }
              return `<td>${r.totalScore ?? '-'}</td>`;
            }).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

boot();
