// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - Supabase 클라우드 서비스 계층 (supabaseService.js)
// ==========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || document.querySelector('meta[name="supabase-url"]')?.content || '';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || document.querySelector('meta[name="supabase-anon-key"]')?.content || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const AuthService = {
  // 이메일/비밀번호 로그인
  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase 연결 설정(SUPABASE_URL / ANON_KEY)이 완료되지 않았습니다.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  // 신규 계정 등록
  async signUp({ email, password, fullName, organizationName }) {
    if (!supabase) throw new Error('Supabase 연결 설정이 완료되지 않았습니다.');
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
    }
    return data.user;
  },

  // 로그아웃
  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // 현재 로그인 세션 확인
  async getCurrentClinician() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
  }
};

export const CloudRepository = {
  // 로그인한 치료사의 데이터 로드
  async fetchAllClinicalData() {
    const user = await AuthService.getCurrentClinician();
    if (!user) throw new Error('클라우드 조회를 위해 치료사 로그인이 필요합니다.');

    const [patientsRes, sessionsRes, tasksRes] = await Promise.all([
      supabase.from('patients').select('*').eq('is_archived', false).order('created_at', { ascending: false }),
      supabase.from('therapy_sessions').select('*').order('conducted_at', { ascending: true }),
      supabase.from('custom_tasks').select('*').eq('is_active', true)
    ]);

    if (patientsRes.error) throw patientsRes.error;
    if (sessionsRes.error) throw sessionsRes.error;
    if (tasksRes.error) throw tasksRes.error;

    return {
      patients: patientsRes.data,
      sessions: sessionsRes.data,
      customTasks: tasksRes.data
    };
  },

  // 회기 저장
  async saveSessionToCloud(sessionRecord) {
    const user = await AuthService.getCurrentClinician();
    if (!user) throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');

    const payload = {
      patient_id: sessionRecord.patientId,
      clinician_id: user.id,
      category: sessionRecord.domain || sessionRecord.category || 'naming',
      initial_difficulty: Number(String(sessionRecord.difficulty || '1').replace('level', '')) || 1,
      final_difficulty: Number(String(sessionRecord.endLevel || sessionRecord.difficulty || '1').replace('level', '')) || 1,
      total_trials: sessionRecord.totalTasks || (sessionRecord.trials ? sessionRecord.trials.length : 0),
      overall_score: sessionRecord.avgScore || (sessionRecord.summary ? sessionRecord.summary.overallScore : 0),
      independent_rate: sessionRecord.independentRate || 0,
      avg_cue_level: sessionRecord.avgCueLevel || 0,
      avg_latency_ms: sessionRecord.avgLatencyMs || 0,
      error_distribution: sessionRecord.errorDistribution || (sessionRecord.summary ? sessionRecord.summary.errorCounts : {}),
      trials: sessionRecord.trials || [],
      soap_report: sessionRecord.soap || sessionRecord.soapReport || {}
    };

    const { data, error } = await supabase.from('therapy_sessions').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
};
