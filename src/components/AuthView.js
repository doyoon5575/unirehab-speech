// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - 치료사 인증(로그인/회원가입) 화면 (AuthView.js)
// ==========================================================================
import { store } from '../store.js';

export function renderAuthView(container, onAuthenticated) {
  let mode = 'login'; // 'login' | 'signup'
  let isSubmitting = false;
  let errorMessage = '';

  function render() {
    const isCloudConfigured = store.isCloudConfigured();

    container.innerHTML = `
      <div class="auth-wrapper" style="max-width: 480px; margin: 3rem auto; padding: 2.25rem; background: #fff; border-radius: 16px; border: 1.5px solid var(--border-light, #e2e8f0); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);">
        
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <span style="display: inline-block; padding: 0.25rem 0.85rem; background: #e0f2fe; color: #0369a1; border-radius: 999px; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.6rem;">
            UniRehab Speech v2.0 Cloud
          </span>
          <h1 style="margin: 0; font-size: 1.5rem; color: #0f172a; font-weight: 800;">치료사 전용 임상 워크스페이스</h1>
          <p style="margin: 0.45rem 0 0 0; font-size: 0.88rem; color: #64748b; line-height: 1.4;">
            담당 환자 보호(RLS 암호화) 및 오프라인-온라인 자동 동기화 지원
          </p>
        </div>

        <!-- 로그인 / 회원가입 탭 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f1f5f9; padding: 0.35rem; border-radius: 10px; margin-bottom: 1.25rem;">
          <button type="button" id="tab-login" style="padding: 0.55rem; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; background: ${mode === 'login' ? '#fff' : 'transparent'}; color: ${mode === 'login' ? '#0f172a' : '#64748b'}; box-shadow: ${mode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">
            치료사 로그인
          </button>
          <button type="button" id="tab-signup" style="padding: 0.55rem; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; background: ${mode === 'signup' ? '#fff' : 'transparent'}; color: ${mode === 'signup' ? '#0f172a' : '#64748b'}; box-shadow: ${mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">
            신규 계정 등록
          </button>
        </div>

        ${errorMessage ? `
          <div style="padding: 0.75rem 1rem; margin-bottom: 1.25rem; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>⚠️</span> <span>${errorMessage}</span>
          </div>
        ` : ''}

        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
          ${mode === 'signup' ? `
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.3rem; color: #334155;">치료사 성명</label>
              <input type="text" id="auth-name" required placeholder="예: 김도윤"
                style="width: 100%; padding: 0.7rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.3rem; color: #334155;">소속 기관명 (병원·센터·연구소)</label>
              <input type="text" id="auth-org" required placeholder="예: 유니원 언어재활센터"
                style="width: 100%; padding: 0.7rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;" />
            </div>
          ` : ''}

          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.3rem; color: #334155;">이메일 계정</label>
            <input type="email" id="auth-email" required placeholder="clinician@example.com"
              style="width: 100%; padding: 0.7rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.3rem; color: #334155;">비밀번호 (8자 이상)</label>
            <input type="password" id="auth-password" required minlength="8" placeholder="••••••••"
              style="width: 100%; padding: 0.7rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;" />
          </div>

          ${mode === 'signup' ? `
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.8rem; color: #475569; background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; line-height: 1.4;">
              <input type="checkbox" id="auth-consent" required style="margin-top: 0.2rem; accent-color: var(--brand-primary);" />
              <span>
                <strong>[필수] 환자 민감정보 보호 및 음성인식 고지 확인:</strong>
                환자 등록 시 가명/병록번호 사용을 권장하며, 자동 음성인식(STT) 사용 시 브라우저 음성 서버를 경유함을 확인합니다.
              </span>
            </label>
          ` : ''}

          <button type="submit" class="btn btn-primary" ${isSubmitting || !isCloudConfigured ? 'disabled' : ''}
            style="padding: 0.8rem; font-weight: 700; font-size: 0.98rem; border-radius: 8px; cursor: pointer; width: 100%; margin-top: 0.25rem;">
            ${isSubmitting ? '인증 처리 중...' : (mode === 'login' ? '클라우드 워크스페이스 로그인' : '치료사 계정 생성 및 시작')}
          </button>
        </form>

        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e2e8f0;" />

        <!-- 오프라인 단독 사용 진입 버튼 -->
        <div style="text-align: center;">
          <p style="font-size: 0.82rem; color: #64748b; margin: 0 0 0.65rem 0;">
            ${isCloudConfigured
              ? '인터넷 연결이 없는 방문재활 환경이신가요?'
              : '현재 서버 환경변수(SUPABASE_URL) 미설정 상태입니다. 오프라인 모드로 즉시 사용 가능합니다.'}
          </p>
          <button type="button" id="btn-offline-mode" class="btn btn-secondary" style="width: 100%; padding: 0.7rem; border-radius: 8px; font-weight: 700; font-size: 0.92rem;">
            💻 오프라인 로컬 모드로 계속하기 (기기 내 저장)
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelector('#tab-login')?.addEventListener('click', () => {
      mode = 'login';
      errorMessage = '';
      render();
    });

    container.querySelector('#tab-signup')?.addEventListener('click', () => {
      mode = 'signup';
      errorMessage = '';
      render();
    });

    container.querySelector('#btn-offline-mode')?.addEventListener('click', () => {
      store.enableOfflineLocalMode();
      onAuthenticated();
    });

    container.querySelector('#auth-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      errorMessage = '';
      isSubmitting = true;
      render();

      const email = container.querySelector('#auth-email')?.value.trim();
      const password = container.querySelector('#auth-password')?.value;

      try {
        if (mode === 'login') {
          await store.signInClinician(email, password);
        } else {
          const fullName = container.querySelector('#auth-name')?.value.trim();
          const orgName = container.querySelector('#auth-org')?.value.trim();
          await store.signUpClinician({ email, password, fullName, organizationName: orgName });
        }
        onAuthenticated();
      } catch (err) {
        errorMessage = err.message || '인증에 실패했습니다. 계정 정보를 확인해 주세요.';
        isSubmitting = false;
        render();
      }
    });
  }

  render();
}
