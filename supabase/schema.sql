-- ============================================================================
-- 유니원 리햅 (UniRehab v2.0) - Supabase PostgreSQL 스키마 및 RLS 보안 정책
-- ============================================================================

-- 1. UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. 치료사(사용자) 프로필 테이블 (Supabase Auth와 1:1 연동)
CREATE TABLE IF NOT EXISTS public.clinician_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  organization_name TEXT DEFAULT '개인 임상실',
  license_type TEXT DEFAULT '언어재활사',
  stt_consent_verified BOOLEAN DEFAULT FALSE,
  ui_settings JSONB DEFAULT '{"fontSize": "medium", "highContrast": false, "speechRate": 0.95}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 환자(대상자) 테이블
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id UUID NOT NULL REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
  patient_code TEXT, -- 실명 대신 가명/병록번호 관리 지원 (예: PT-2026-001)
  display_name TEXT NOT NULL,
  birth_year INT,
  gender TEXT CHECK (gender IN ('남', '여', '기타', '미지정')) DEFAULT '미지정',
  diagnosis TEXT NOT NULL, -- 예: 뇌경색 후 브로카 실어증
  severity TEXT CHECK (severity IN ('경도', '중등도', '심도')) DEFAULT '중등도',
  clinical_notes TEXT DEFAULT '',
  recommended_difficulty INT CHECK (recommended_difficulty BETWEEN 1 AND 3) DEFAULT 1,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 치료 회기(Session) 및 문항별 정량 수행 기록 테이블
CREATE TABLE IF NOT EXISTS public.therapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('naming', 'sentence', 'auditory', 'pragmatics', 'custom')),
  initial_difficulty INT NOT NULL CHECK (initial_difficulty BETWEEN 1 AND 3),
  final_difficulty INT NOT NULL CHECK (final_difficulty BETWEEN 1 AND 3),
  total_trials INT NOT NULL DEFAULT 0,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,       -- 단서 가중치 반영 점수 (0~100)
  independent_rate NUMERIC(5,2) NOT NULL DEFAULT 0,    -- 무단서 자발 정반응률 (%)
  avg_cue_level NUMERIC(4,2) NOT NULL DEFAULT 0,       -- 평균 제공 단서 단계 (0~6)
  avg_latency_ms INT NOT NULL DEFAULT 0,               -- 평균 반응 잠복기 (ms)
  error_distribution JSONB NOT NULL DEFAULT '{}'::jsonb, -- 7대 오류 유형 집계
  trials JSONB NOT NULL DEFAULT '[]'::jsonb,             -- 문항별 상세 반응 배열
  soap_report JSONB NOT NULL DEFAULT '{}'::jsonb,        -- 자동 생성 + 치료사 수정 SOAP 노트
  clinician_memo TEXT DEFAULT '',
  conducted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 치료계획 기반 AI/치료사 맞춤형 문항 뱅크 테이블
CREATE TABLE IF NOT EXISTS public.custom_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id UUID NOT NULL REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL, -- 특정 환자 전용 또는 치료사 공통
  therapy_goal TEXT NOT NULL, -- 예: "연결어미 '-면서'를 활용한 복문 산출"
  category TEXT NOT NULL CHECK (category IN ('naming', 'sentence', 'auditory', 'pragmatics')),
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  task_payload JSONB NOT NULL, -- prompt, target, alternatives, cues, options 등
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 인덱스 설정 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_patients_clinician ON public.patients(clinician_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_patient_date ON public.therapy_sessions(patient_id, conducted_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_lookup ON public.custom_tasks(clinician_id, category, difficulty);

-- ============================================================================
-- 7. 행 수준 보안(RLS: Row Level Security) 설정 — 타 치료사 접근 원천 차단
-- ============================================================================
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tasks ENABLE ROW LEVEL SECURITY;

-- 기존 정책 존재 시 재정의를 위해 DROP 처리
DROP POLICY IF EXISTS "clinician_own_profile" ON public.clinician_profiles;
DROP POLICY IF EXISTS "clinician_own_patients" ON public.patients;
DROP POLICY IF EXISTS "clinician_own_sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "clinician_own_custom_tasks" ON public.custom_tasks;

-- [정책 1] 치료사 본인 프로필만 조회/수정
CREATE POLICY "clinician_own_profile" ON public.clinician_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- [정책 2] 치료사 본인이 등록한 환자만 조회/추가/수정/삭제
CREATE POLICY "clinician_own_patients" ON public.patients
  FOR ALL USING (auth.uid() = clinician_id) WITH CHECK (auth.uid() = clinician_id);

-- [정책 3] 치료사 본인이 진행한 회기 기록만 조회/추가/수정/삭제
CREATE POLICY "clinician_own_sessions" ON public.therapy_sessions
  FOR ALL USING (auth.uid() = clinician_id) WITH CHECK (auth.uid() = clinician_id);

-- [정책 4] 치료사 본인이 생성한 맞춤형 문항만 조회/추가/수정/삭제
CREATE POLICY "clinician_own_custom_tasks" ON public.custom_tasks
  FOR ALL USING (auth.uid() = clinician_id) WITH CHECK (auth.uid() = clinician_id);
