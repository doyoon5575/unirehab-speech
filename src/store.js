// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - 오프라인-온라인 하이브리드 상태 저장소 (store.js)
// ==========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const STORAGE_KEYS = {
  PATIENTS: 'unirehab_patients_v2',
  ACTIVE_PATIENT_ID: 'unirehab_active_patient_id_v2',
  SESSIONS: 'unirehab_sessions_v2',
  SETTINGS: 'unirehab_settings_v2',
  CUSTOM_TASKS: 'unirehab_custom_tasks_v2',
  SYNC_QUEUE: 'unirehab_sync_queue_v2',
  AUTH_MODE: 'unirehab_auth_mode_v2'
};

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * 1. 충돌 없는 고유 ID 생성기 (Web Crypto API 표준 UUID + 폴백)
 */
export function generateId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${prefix}-${Date.now().toString(36)}-${randomHex()}-${randomHex()}`;
}

/**
 * 2. 백업 JSON 파일 무결성 및 스키마 검증기
 */
export function validateBackupSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['유효한 JSON 객체 형식이 아닙니다.'] };
  }

  // 필수 최상위 배열 확인
  if (!Array.isArray(data.patients)) {
    errors.push('patients(환자 목록) 배열이 누락되었거나 형식이 잘못되었습니다.');
  }
  if (!Array.isArray(data.sessions)) {
    errors.push('sessions(회기 기록) 배열이 누락되었거나 형식이 잘못되었습니다.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 환자 항목 필수 필드 검사
  const patientIds = new Set();
  data.patients.forEach((p, idx) => {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !p.name.trim()) {
      errors.push(`환자 데이터 [${idx + 1}번째]에 필수 항목(id, name)이 누락되었습니다.`);
    } else if (patientIds.has(p.id)) {
      errors.push(`중복된 환자 ID(${p.id})가 존재합니다.`);
    } else {
      patientIds.add(p.id);
    }
  });

  // 회기 항목 필수 필드 및 참조 무결성 검사
  const sessionIds = new Set();
  data.sessions.forEach((s, idx) => {
    if (!s || typeof s.id !== 'string' || typeof s.patientId !== 'string') {
      errors.push(`회기 데이터 [${idx + 1}번째]에 필수 항목(id, patientId)이 누락되었습니다.`);
    } else {
      if (sessionIds.has(s.id)) {
        errors.push(`중복된 회기 ID(${s.id})가 존재합니다.`);
      }
      sessionIds.add(s.id);
    }
    if (s && s.trials && !Array.isArray(s.trials)) {
      errors.push(`회기(${s.id})의 trials 데이터가 배열이 아닙니다.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// 초기 데모 환자군 (isDemo: true 명시)
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
    notes: '비유창성 실어증, 발어 노력 및 어휘 인출 지연 두드러짐. 초성 및 첫음절 단서에 즉각적 반응성 양호.',
    isDemo: true
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
    notes: '구어 유창성은 양호하나 목표 어휘 우회 표현 빈번. 문맥 단서 제공 시 수행도 향상.',
    isDemo: true
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
    notes: '주의집중 분산 주의. 짧고 명료한 청각 자극 및 시각적 지지 구조가 필수적임.',
    isDemo: true
  }
];

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
    },
    isDemo: true
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
    },
    isDemo: true
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
    },
    isDemo: true
  }
];

const DEFAULT_SETTINGS = {
  fontSize: 'text-md',
  highContrast: false,
  speechRate: 1.0,
  autoTts: true,
  adaptiveDifficulty: true
};

// Supabase 클라이언트 초기화 (window.__ENV__ 또는 meta 태그에서 로드)
const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || document.querySelector('meta[name="supabase-url"]')?.content || '';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

class Store {
  constructor() {
    this.listeners = new Set();
    this.user = null;
    this.authMode = localStorage.getItem(STORAGE_KEYS.AUTH_MODE) || (supabase ? 'cloud' : 'offline');
    this.syncStatus = navigator.onLine ? 'IDLE' : 'OFFLINE'; // 'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE' | 'ERROR'
    this.isFlushing = false;
    this.init();
  }

  init() {
    this.patients = this._loadJSON(STORAGE_KEYS.PATIENTS, INITIAL_PATIENTS);
    this.sessions = this._loadJSON(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
    this.customTasks = this._loadJSON(STORAGE_KEYS.CUSTOM_TASKS, []);
    this.settings = { ...DEFAULT_SETTINGS, ...this._loadJSON(STORAGE_KEYS.SETTINGS, {}) };
    this.syncQueue = this._loadJSON(STORAGE_KEYS.SYNC_QUEUE, []);

    // Ensure demo patients have isDemo flag
    this.patients.forEach(p => {
      if (['pat-101', 'pat-102', 'pat-103'].includes(p.id) && p.isDemo === undefined) {
        p.isDemo = true;
      }
    });

    const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT_ID);
    this.activePatientId = this.patients.some(p => p.id === savedActiveId)
      ? savedActiveId
      : (this.patients[0]?.id || null);

    // 온라인/오프라인 네트워크 상태 변화 감지 리스너 등록
    window.addEventListener('online', () => {
      this.syncStatus = 'IDLE';
      this.notify('SYNC_STATUS_CHANGED');
      this.flushSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.syncStatus = 'OFFLINE';
      this.notify('SYNC_STATUS_CHANGED');
    });

    // Supabase 세션 복구 및 초기 동기화
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          this.user = session.user;
          this.authMode = 'cloud';
          this.notify('AUTH_CHANGED');
          this.pullFromCloud().then(() => this.flushSyncQueue());
        }
      }).catch(err => {
        console.warn('Supabase session restore check:', err);
      });
    }
  }

  _loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  _saveLocal() {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(this.patients));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TASKS, JSON.stringify(this.customTasks));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(this.syncQueue));
    if (this.activePatientId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT_ID, this.activePatientId);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(fn => {
      try { fn(event, data); } catch (e) { console.error('Store notify error:', e); }
    });
  }

  // ========================================================================
  // 인증(Auth) 및 오프라인 모드 제어
  // ========================================================================
  isCloudConfigured() {
    return Boolean(supabase);
  }

  isAuthenticated() {
    return this.authMode === 'offline' || Boolean(this.user);
  }

  enableOfflineLocalMode() {
    this.authMode = 'offline';
    localStorage.setItem(STORAGE_KEYS.AUTH_MODE, 'offline');
    this.notify('AUTH_CHANGED');
  }

  async signInClinician(email, password) {
    if (!supabase) throw new Error('Supabase 설정이 없습니다.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    this.authMode = 'cloud';
    localStorage.setItem(STORAGE_KEYS.AUTH_MODE, 'cloud');
    await this.pullFromCloud();
    await this.flushSyncQueue();
    this.notify('AUTH_CHANGED');
    return this.user;
  }

  async signUpClinician({ email, password, fullName, organizationName }) {
    if (!supabase) throw new Error('Supabase 설정이 없습니다.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await supabase.from('clinician_profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        organization_name: organizationName,
        stt_consent_verified: true
      });
      this.user = data.user;
      this.authMode = 'cloud';
      localStorage.setItem(STORAGE_KEYS.AUTH_MODE, 'cloud');
      this.notify('AUTH_CHANGED');
    }
    return data.user;
  }

  async signOutClinician() {
    if (supabase) await supabase.auth.signOut();
    this.user = null;
    this.authMode = 'cloud';
    localStorage.removeItem(STORAGE_KEYS.AUTH_MODE);
    this.notify('AUTH_CHANGED');
  }

  // ========================================================================
  // 오프라인-온라인 자동 동기화 큐 (Sync Queue Engine)
  // ========================================================================
  enqueueSyncOperation(type, payload) {
    if (payload?.isDemo) return;

    this.syncQueue.push({
      opId: generateId('sync'),
      type,
      payload,
      timestamp: new Date().toISOString()
    });
    this._saveLocal();
    this.notify('SYNC_STATUS_CHANGED');

    if (navigator.onLine && this.user && supabase) {
      this.flushSyncQueue();
    }
  }

  async flushSyncQueue() {
    if (this.isFlushing || !navigator.onLine || !this.user || !supabase || this.syncQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    this.syncStatus = 'SYNCING';
    this.notify('SYNC_STATUS_CHANGED');

    const remainingQueue = [];

    for (const item of this.syncQueue) {
      try {
        if (item.type === 'UPSERT_PATIENT') {
          const p = item.payload;
          const { error } = await supabase.from('patients').upsert({
            id: p.id,
            clinician_id: this.user.id,
            display_name: p.name,
            gender: p.gender || '미지정',
            diagnosis: p.diagnosis || '',
            severity: p.severity || '중등도',
            clinical_notes: JSON.stringify({
              age: p.age,
              onsetDate: p.onsetDate,
              targetDomain: p.targetDomain,
              difficulty: p.difficulty,
              goals: p.goals,
              notes: p.notes
            })
          });
          if (error) throw error;
        } else if (item.type === 'INSERT_SESSION') {
          const s = item.payload;
          const levelNum = Number(String(s.difficulty || 'level1').replace('level', '')) || 1;
          const endLevelNum = Number(String(s.endLevel || s.difficulty || 'level1').replace('level', '')) || 1;
          const { error } = await supabase.from('therapy_sessions').upsert({
            id: s.id,
            patient_id: s.patientId,
            clinician_id: this.user.id,
            category: s.domain || 'naming',
            initial_difficulty: levelNum,
            final_difficulty: endLevelNum,
            total_trials: s.totalTasks || (s.trials ? s.trials.length : 0),
            overall_score: s.avgScore || (s.summary ? s.summary.overallScore : 0),
            independent_rate: s.independentRate || 0,
            avg_cue_level: s.avgCueLevel || 0,
            avg_latency_ms: s.avgLatencyMs || 0,
            error_distribution: s.errorDistribution || {},
            trials: s.trials || [],
            soap_report: s.soap || {}
          });
          if (error) throw error;
        } else if (item.type === 'INSERT_CUSTOM_TASKS') {
          const tasks = Array.isArray(item.payload) ? item.payload : [item.payload];
          const rows = tasks.map(t => ({
            id: t.id,
            clinician_id: this.user.id,
            patient_id: t.patientId && !String(t.patientId).startsWith('pat-10') ? t.patientId : null,
            therapy_goal: t.therapyGoal || '맞춤 문항',
            category: t.domain || t.category || 'naming',
            difficulty: Number(String(t.difficulty || 'level2').replace('level', '')) || 2,
            task_payload: t
          }));
          const { error } = await supabase.from('custom_tasks').upsert(rows);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('[SyncQueue] 동기화 보류 (재시도 예정):', item.type, err.message);
        remainingQueue.push(item);
      }
    }

    this.syncQueue = remainingQueue;
    this._saveLocal();
    this.isFlushing = false;
    this.syncStatus = remainingQueue.length === 0 ? 'SYNCED' : 'ERROR';
    this.notify('SYNC_STATUS_CHANGED');
  }

  async pullFromCloud() {
    if (!navigator.onLine || !this.user || !supabase) return;
    try {
      this.syncStatus = 'SYNCING';
      this.notify('SYNC_STATUS_CHANGED');

      const [patRes, sessRes, taskRes] = await Promise.all([
        supabase.from('patients').select('*').eq('is_archived', false),
        supabase.from('therapy_sessions').select('*').order('conducted_at', { ascending: true }),
        supabase.from('custom_tasks').select('*').eq('is_active', true)
      ]);

      if (!patRes.error && Array.isArray(patRes.data) && patRes.data.length > 0) {
        const cloudPatients = patRes.data.map(row => {
          let meta = {};
          try { meta = JSON.parse(row.clinical_notes || '{}'); } catch {}
          return {
            id: row.id,
            name: row.display_name,
            age: meta.age || 60,
            gender: row.gender || '미지정',
            diagnosis: row.diagnosis,
            onsetDate: meta.onsetDate || '',
            severity: row.severity,
            targetDomain: meta.targetDomain || 'naming',
            difficulty: meta.difficulty || 'level1',
            goals: meta.goals || { ltg: '', stg: '' },
            notes: meta.notes || '',
            isDemo: false
          };
        });
        const cloudIds = new Set(cloudPatients.map(p => p.id));
        const localOnly = this.patients.filter(p => !cloudIds.has(p.id));
        this.patients = [...cloudPatients, ...localOnly];
      }

      if (!taskRes.error && Array.isArray(taskRes.data)) {
        const cloudTasks = taskRes.data.map(r => r.task_payload);
        const existingIds = new Set(cloudTasks.map(t => t.id));
        const localOnlyTasks = this.customTasks.filter(t => !existingIds.has(t.id));
        this.customTasks = [...cloudTasks, ...localOnlyTasks];
      }

      this._saveLocal();
      this.syncStatus = 'SYNCED';
      this.notify('PATIENTS_UPDATED');
      this.notify('SYNC_STATUS_CHANGED');
    } catch (e) {
      console.warn('Pull from cloud note:', e);
      this.syncStatus = 'ERROR';
      this.notify('SYNC_STATUS_CHANGED');
    }
  }

  // ========================================================================
  // 환자 · 회기 · 맞춤 문항 CRUD 메서드
  // ========================================================================
  getPatients() {
    return this.patients || [];
  }

  getActivePatient() {
    return (this.patients || []).find(p => p.id === this.activePatientId) || this.patients[0] || INITIAL_PATIENTS[0];
  }

  setActivePatientId(id) {
    this.activePatientId = id;
    this._saveLocal();
    this.notify('PATIENT_CHANGED', id);
  }

  setActivePatient(id) {
    this.setActivePatientId(id);
  }

  addPatient(patientData) {
    const newPatient = {
      ...patientData,
      id: generateId('pat'),
      isDemo: false,
      createdDate: new Date().toISOString().split('T')[0]
    };
    this.patients.push(newPatient);
    this.activePatientId = newPatient.id;
    this._saveLocal();
    this.enqueueSyncOperation('UPSERT_PATIENT', newPatient);
    this.notify('PATIENTS_UPDATED', newPatient);
    return newPatient;
  }

  updatePatient(id, fields) {
    const idx = this.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.patients[idx] = { ...this.patients[idx], ...fields };
      this._saveLocal();
      this.enqueueSyncOperation('UPSERT_PATIENT', this.patients[idx]);
      this.notify('PATIENTS_UPDATED', this.patients[idx]);
      return this.patients[idx];
    }
    return null;
  }

  deletePatient(id) {
    if (this.patients.length <= 1) return false;
    this.patients = this.patients.filter(p => p.id !== id);
    this.activePatientId = this.patients[0]?.id || null;
    this._saveLocal();
    this.notify('PATIENTS_UPDATED', this.patients);
    return true;
  }

  getSessions(patientId = null) {
    const all = this.sessions || [];
    if (patientId) {
      return all.filter(s => s.patientId === patientId);
    }
    return all;
  }

  getPatientSessions(patientId = this.activePatientId) {
    return this.getSessions(patientId);
  }

  addSession(sessionData) {
    const newSession = {
      ...sessionData,
      id: generateId('sess'),
      date: sessionData.date || new Date().toISOString().slice(0, 10),
      isDemo: false
    };
    this.sessions.push(newSession);
    this._saveLocal();
    this.enqueueSyncOperation('INSERT_SESSION', newSession);
    this.notify('SESSION_ADDED', newSession);
    return newSession;
  }

  updateSessionSoap(sessionId, soapUpdates) {
    const idx = this.sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      this.sessions[idx].soap = { ...this.sessions[idx].soap, ...soapUpdates };
      this._saveLocal();
      this.enqueueSyncOperation('INSERT_SESSION', this.sessions[idx]);
      this.notify('SESSION_UPDATED', this.sessions[idx]);
      return this.sessions[idx];
    }
    return null;
  }

  getCustomTasks(domain = null, difficulty = null) {
    return (this.customTasks || []).filter(t => {
      const domainMatch = !domain || (t.domain || t.category) === domain;
      const diffMatch = !difficulty || t.difficulty === difficulty || String(t.difficulty) === String(difficulty).replace('level', '');
      return domainMatch && diffMatch;
    });
  }

  addCustomTasks(tasksArray) {
    if (!Array.isArray(tasksArray) || tasksArray.length === 0) return;
    this.customTasks = [...tasksArray, ...this.customTasks];
    this._saveLocal();
    this.enqueueSyncOperation('INSERT_CUSTOM_TASKS', tasksArray);
    this.notify('CUSTOM_TASKS_UPDATED', tasksArray);
  }

  clearDemoData() {
    const demoPatientIds = new Set(
      this.patients.filter(p => p.isDemo === true).map(p => p.id)
    );
    this.patients = this.patients.filter(p => !p.isDemo);
    this.sessions = this.sessions.filter(s => !demoPatientIds.has(s.patientId));
    
    if (demoPatientIds.has(this.activePatientId) || !this.activePatientId) {
      this.activePatientId = this.patients[0]?.id || null;
    }
    this._saveLocal();
    this.notify('PATIENTS_UPDATED');
    this.notify('SESSIONS_UPDATED');
    return true;
  }

  getSettings() {
    return this.settings || DEFAULT_SETTINGS;
  }

  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    this._saveLocal();
    this.applySettingsToDOM(this.settings);
    this.notify('SETTINGS_UPDATED', this.settings);
  }

  applySettingsToDOM(settings = null) {
    const s = settings || this.getSettings();
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (htmlEl) {
      htmlEl.classList.remove('text-md', 'text-lg', 'text-xl');
      htmlEl.classList.add(s.fontSize || 'text-md');
    }

    if (bodyEl) {
      if (s.highContrast) {
        bodyEl.classList.add('high-contrast');
      } else {
        bodyEl.classList.remove('high-contrast');
      }
    }
  }

  exportBackupJSON() {
    const data = {
      version: '2.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      patients: this.getPatients(),
      sessions: this.getSessions(),
      customTasks: this.customTasks,
      settings: this.getSettings()
    };
    return JSON.stringify(data, null, 2);
  }

  importBackupJSON(jsonStr) {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('파일이 손상되었거나 올바른 JSON 형식이 아닙니다.');
    }

    const validation = validateBackupSchema(parsed);
    if (!validation.valid) {
      throw new Error(`백업 데이터 검증 실패:\n- ${validation.errors.slice(0, 3).join('\n- ')}`);
    }

    this.patients = parsed.patients;
    this.sessions = parsed.sessions;
    if (parsed.settings && typeof parsed.settings === 'object') {
      this.settings = { ...this.settings, ...parsed.settings };
    }
    if (Array.isArray(parsed.customTasks)) {
      this.customTasks = parsed.customTasks;
    }
    this.activePatientId = this.patients[0]?.id || null;
    this._saveLocal();
    this.applySettingsToDOM(this.settings);
    this.notify('DATA_RESTORED');
    this.notify('PATIENTS_UPDATED');
    return true;
  }
}

export const store = new Store();
