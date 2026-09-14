// Phase 1 백엔드(server/src/routes/*)를 호출하는 얇은 fetch 래퍼.
const Api = (() => {
  function token() { return localStorage.getItem('mf_token'); }
  function setSession(token_, role) {
    localStorage.setItem('mf_token', token_);
    localStorage.setItem('mf_role', role);
  }
  function clearSession() {
    localStorage.removeItem('mf_token');
    localStorage.removeItem('mf_role');
  }
  function role() { return localStorage.getItem('mf_role'); }

  async function request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) { clearSession(); location.reload(); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    return data;
  }

  return {
    setSession, clearSession, token, role,
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    listStudies: () => request('GET', '/studies'),
    getStudy: (id) => request('GET', `/studies/${id}`),
    listArms: (studyId) => request('GET', `/studies/${studyId}/arms`),
    listVisitDefinitions: (studyId) => request('GET', `/studies/${studyId}/visit-definitions`),
    listSubjects: (studyId) => request('GET', `/studies/${studyId}/subjects`),
    createSubject: (studyId, body) => request('POST', `/studies/${studyId}/subjects`, body),
    getSubject: (id) => request('GET', `/subjects/${id}`),
    updateSubject: (id, body) => request('PATCH', `/subjects/${id}`, body),
    listVisits: (subjectId) => request('GET', `/subjects/${subjectId}/visits`),
    upsertVisit: (subjectId, body) => request('POST', `/subjects/${subjectId}/visits`, body),
    updateVisit: (visitId, body) => request('PATCH', `/visits/${visitId}`, body),
    getVisitResponses: (visitId) => request('GET', `/visits/${visitId}/assessment-responses`),
    saveVisitResponse: (visitId, assessmentId, body) =>
      request('PUT', `/visits/${visitId}/assessment-responses/${assessmentId}`, body),
    getSubjectResponses: (subjectId) => request('GET', `/subjects/${subjectId}/assessment-responses`),
  };
})();
