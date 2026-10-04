// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - 상태 관리 저장소 (store.js)
// ==========================================================================

const STORAGE_KEYS = {
  PATIENTS: 'unirehab_patients_v2',
  ACTIVE_PATIENT_ID: 'unirehab_active_patient_id_v2',
  SESSIONS: 'unirehab_sessions_v2',
  SETTINGS: 'unirehab_settings_v2'
};

// 기본 환자 데이터군
const INITIAL_PATIENTS = [
  {
    id: 'pat-101',
    name: '김철수',
    age: 64,
    gender: '남성',
    diagnosis: '좌측 중대뇌동맥(MCA) 뇌경색 후 브로카 실어증 (Broca Aphasia)',
    onsetDate: '2025-11-10',
    severity: '중등도 (Moderate)',
    targetDomain: 'naming',
    difficulty: 'level2',
    goals: {
      ltg: '일상생활 기본 요구 및 필수 어휘 80% 이상 자발적 명명 산출',
      stg: '시각 자극 3초 이내 2~3음절 생활 명사 독립 인출률 80% 달성'
    },
    notes: '비유창성 실어증, 발어 노력 및 어휘 인출 지연 두드러짐. 초성 및 첫음절 단서에 즉각적 반응성 양호.'
  },
  {
    id: 'pat-102',
    name: '이영희',
    age: 58,
    gender: '여성',
    diagnosis: '자발성 뇌출혈(ICH) 후 건망성(명칭) 실어증 (Anomic Aphasia)',
    onsetDate: '2026-02-14',
    severity: '경도 (Mild)',
    targetDomain: 'sentence',
    difficulty: 'level2',
    goals: {
      ltg: '복합 상황 묘사 및 문장 완성 시 문법적 조사 완결성 85% 달성',
      stg: '주어+목적어+서술어 3성분 문장 구성 발화'
    },
    notes: '구어 유창성은 양호하나 목표 어휘 우회 표현 빈번. 문맥 단서 제공 시 수행도 향상.'
  },
  {
    id: 'pat-103',
    name: '박민우',
    age: 67,
    gender: '남성',
    diagnosis: '외상성 뇌손상(TBI) 후 인지-의사소통 장애',
    onsetDate: '2025-08-20',
    severity: '경중등도 (Mild-Moderate)',
    targetDomain: 'auditory',
    difficulty: 'level1',
    goals: {
      ltg: '청각적 2단계 지시 수행 및 복합 문맥 이해력 90% 회복',
      stg: '어휘 대조군 중 핵심 목표어 청각 식별'
    },
    notes: '주의집중 분산 주의. 짧고 명료한 청각 자극 및 시각적 지지 구조가 필수적임.'
  }
];

// 초기 시뮬레이션 세션 기록
const INITIAL_SESSIONS = [
  {
    id: 'sess-001',
    patientId: 'pat-101',
    date: '2026-09-12',
    domain: 'naming',
    difficulty: 'level1',
    endLevel: 'level1',
    adaptive: true,
    levelChanges: [],
    totalTasks: 10,
    correctCount: 6,
    accuracy: 60,
    independentRate: 40,
    avgScore: 68,
    avgLatencyMs: 3400,
    avgCueLevel: 2.1,
    hintUsedCount: 4,
    cueDistribution: [4, 1, 2, 2, 1, 0, 0],
    errorDistribution: { NONE: 6, PARTIAL: 1, PHONEMIC: 2, SEMANTIC: 1, CIRCUMLOCUTION: 0, NO_RESPONSE: 0, UNRELATED: 0 },
    soap: {
      s: '환자가 과제 시작 시 다소 피로감을 호소하였으나 적극적으로 발화에 참여함.',
      o: '어휘 인출 영역 10문항 수행. 정반응 6문항(60%), 자발 산출률 40%, 평균 단서 수준 2.1단계, 평균 반응 잠복기 3.4초.',
      a: '초성 단서 제공 시 인출 성공률이 상승하며 음운 지연 완화 경향 확인.',
      p: '동일 난이도 유지하며 일상 고빈도 명사 중심 반복 인출 훈련 지속 권고.'
    }
  },
  {
    id: 'sess-002',
    patientId: 'pat-101',
    date: '2026-09-19',
    domain: 'naming',
    difficulty: 'level1',
    endLevel: 'level2',
    adaptive: true,
    levelChanges: [{ from: 'level1', to: 'level2', action: 'UP', reason: '연속 정답에 의한 상향' }],
    totalTasks: 10,
    correctCount: 7,
    accuracy: 70,
    independentRate: 50,
    avgScore: 74,
    avgLatencyMs: 2850,
    avgCueLevel: 1.6,
    hintUsedCount: 3,
    cueDistribution: [5, 2, 1, 1, 1, 0, 0],
    errorDistribution: { NONE: 7, PARTIAL: 1, PHONEMIC: 1, SEMANTIC: 1, CIRCUMLOCUTION: 0, NO_RESPONSE: 0, UNRELATED: 0 },
    soap: {
      s: '이전보다 발화에 높은 자신감을 보이며 밝은 표정으로 참여함.',
      o: '정반응률 70% 달성, 평균 반응 잠복기 2.85초로 단축, 적응형 2단계 자동 상향 경험.',
      a: '반응 잠복기 550ms 유의미하게 단축되었고 자발 산출 비중 증가 추세.',
      p: '2단계 중빈도 생활 어휘 적용 및 문장 수준으로의 확장 준비.'
    }
  },
  {
    id: 'sess-003',
    patientId: 'pat-101',
    date: '2026-09-26',
    domain: 'naming',
    difficulty: 'level2',
    endLevel: 'level2',
    adaptive: true,
    levelChanges: [],
    totalTasks: 10,
    correctCount: 8,
    accuracy: 80,
    independentRate: 70,
    avgScore: 84,
    avgLatencyMs: 2200,
    avgCueLevel: 0.9,
    hintUsedCount: 2,
    cueDistribution: [7, 1, 1, 0, 1, 0, 0],
    errorDistribution: { NONE: 8, PARTIAL: 1, PHONEMIC: 1, SEMANTIC: 0, CIRCUMLOCUTION: 0, NO_RESPONSE: 0, UNRELATED: 0 },
    soap: {
      s: '스스로 목표어를 떠올리려 집중하며 힌트 요청 빈도가 눈에 띄게 감소함.',
      o: '정반응률 80% 달성, 자발 산출률 70%, 평균 단서 수준 0.9단계로 최저치 기록.',
      a: '단기 치료목표(STG 80%) 기준 도달. 회기 간 안정적 인출 경로 확보 확인.',
      p: '문장 완성 및 일상 화용 수준의 복합 과제로 진도 확대 권고.'
    }
  }
];

class Store {
  constructor() {
    this.listeners = new Set();
    this.init();
  }

  init() {
    // v1 -> v2 마이그레이션 호환 처리
    if (!localStorage.getItem(STORAGE_KEYS.PATIENTS)) {
      const v1Patients = localStorage.getItem('unirehab_patients_v1');
      if (v1Patients) {
        try {
          localStorage.setItem(STORAGE_KEYS.PATIENTS, v1Patients);
        } catch (e) {
          localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(INITIAL_PATIENTS));
        }
      } else {
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(INITIAL_PATIENTS));
      }
    }

    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT_ID)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT_ID, 'pat-101');
    }

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
        fontSize: 'text-md',
        highContrast: false,
        speechRate: 1.0,
        autoTts: true,
        adaptiveDifficulty: true
      }));
    }

    if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_SESSIONS));
    }
  }

  getPatients() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PATIENTS)) || [];
    } catch {
      return INITIAL_PATIENTS;
    }
  }

  getActivePatient() {
    const list = this.getPatients();
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT_ID);
    return list.find(p => p.id === id) || list[0] || INITIAL_PATIENTS[0];
  }

  setActivePatientId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT_ID, id);
    this.notify('PATIENT_CHANGED', id);
  }

  addPatient(patientData) {
    const list = this.getPatients();
    const newPat = {
      ...patientData,
      id: 'pat-' + Date.now().toString().slice(-4),
      createdDate: new Date().toISOString().split('T')[0]
    };
    list.push(newPat);
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
    this.setActivePatientId(newPat.id);
    this.notify('PATIENTS_UPDATED', newPat);
    return newPat;
  }

  updatePatient(id, fields) {
    const list = this.getPatients();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...fields };
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
      this.notify('PATIENTS_UPDATED', list[idx]);
      return list[idx];
    }
    return null;
  }

  deletePatient(id) {
    let list = this.getPatients();
    if (list.length <= 1) return false; // 최소 1명 유지
    list = list.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
    this.setActivePatientId(list[0].id);
    this.notify('PATIENTS_UPDATED', list);
    return true;
  }

  getSessions(patientId = null) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS)) || [];
      if (patientId) {
        return all.filter(s => s.patientId === patientId);
      }
      return all;
    } catch {
      return [];
    }
  }

  addSession(sessionData) {
    const all = this.getSessions();
    const newSess = {
      ...sessionData,
      id: 'sess-' + Date.now().toString().slice(-6)
    };
    all.push(newSess);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(all));
    this.notify('SESSION_ADDED', newSess);
    return newSess;
  }

  updateSessionSoap(sessionId, soapUpdates) {
    const all = this.getSessions();
    const idx = all.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      all[idx].soap = { ...all[idx].soap, ...soapUpdates };
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(all));
      this.notify('SESSION_UPDATED', all[idx]);
      return all[idx];
    }
    return null;
  }

  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
    } catch {
      return { fontSize: 'text-md', highContrast: false, speechRate: 1.0, autoTts: true };
    }
  }

  updateSettings(updates) {
    const cur = this.getSettings();
    const updated = { ...cur, ...updates };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.applySettingsToDOM(updated);
    this.notify('SETTINGS_UPDATED', updated);
  }

  applySettingsToDOM(settings = null) {
    const s = settings || this.getSettings();
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    htmlEl.classList.remove('text-md', 'text-lg', 'text-xl');
    htmlEl.classList.add(s.fontSize || 'text-md');

    if (s.highContrast) {
      bodyEl.classList.add('high-contrast');
    } else {
      bodyEl.classList.remove('high-contrast');
    }
  }

  // 전체 데이터 내보내기/가져오기 (JSON 백업)
  exportBackupJSON() {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      patients: this.getPatients(),
      sessions: this.getSessions(),
      settings: this.getSettings()
    };
    return JSON.stringify(data, null, 2);
  }

  importBackupJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.patients && Array.isArray(data.patients)) {
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(data.patients));
      }
      if (data.sessions && Array.isArray(data.sessions)) {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
      }
      if (data.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      this.init();
      this.notify('DATA_RESTORED');
      return true;
    } catch (err) {
      console.error('Import failed:', err);
      return false;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(l => {
      try { l(event, data); } catch (e) { console.error(e); }
    });
  }
}

export const store = new Store();
