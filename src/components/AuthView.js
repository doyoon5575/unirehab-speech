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
      <div class="auth-wrapper" style="max-width: 460px; margin: 3.5rem auto; padding: 2.5rem 2.2rem; background: #fff; border-radius: var(--radius-xl); border: 1px solid var(--border-hairline); box-shadow: var(--shadow-card);">
        
        <div style="text-align: center; margin-bottom: 1.8rem;">
          <span class="rehab-pill-badge" style="margin-bottom: 0.8rem;">임상 워크스페이스</span>
          <h1 style="margin: 0; font-size: 1.5rem; color: var(--text-primary); font-weight: 800; letter-spacing: -0.025em;">치료사 전용 로그인</h1>
          <p style="margin: 0.45rem 0 0 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
            성인 신경계 언어장애 환자의 발음 및 재활 데이터 관리
          </p>
        </div>

        <!-- 로그인 / 회원가입 탭 (말잇다 알약형 캡슐) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; background: var(--color-tint); padding: 0.3rem; border-radius: var(--radius-pill); margin-bottom: 1.5rem; border: 1px solid rgba(31, 79, 224, 0.08);">
          <button type="button" id="tab-login" style="padding: 0.6rem; border: none; border-radius: var(--radius-pill); font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all var(--transition-fast); background: ${mode === 'login' ? '#fff' : 'transparent'}; color: ${mode === 'login' ? 'var(--color-accent)' : 'var(--text-secondary)'}; box-shadow: ${mode === 'login' ? '0 2px 8px rgba(31, 79, 224, 0.12)' : 'none'};">
            치료사 로그인
          </button>
          <button type="button" id="tab-signup" style="padding: 0.6rem; border: none; border-radius: var(--radius-pill); font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all var(--transition-fast); background: ${mode === 'signup' ? '#fff' : 'transparent'}; color: ${mode === 'signup' ? 'var(--color-accent)' : 'var(--text-secondary)'}; box-shadow: ${mode === 'signup' ? '0 2px 8px rgba(31, 79, 224, 0.12)' : 'none'};">
            신규 계정 등록
          </button>
        </div>

        ${errorMessage ? `
          <div style="padding: 0.75rem 1rem; margin-bottom: 1.25rem; border-radius: var(--radius-md); background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>⚠️</span> <span>${errorMessage}</span>
          </div>
        ` : ''}

        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1.1rem;">
          ${mode === 'signup' ? `
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-primary);">치료사 성명</label>
              <input type="text" id="auth-name" required placeholder="예: 김도윤"
                style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-hairline); border-radius: var(--radius-md); font-size: 0.95rem; background: var(--bg-subtle);" />
            </div>
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-primary);">소속 기관명 (병원·센터·연구소)</label>
              <input type="text" id="auth-org" required placeholder="예: 유니원 언어재활센터"
                style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-hairline); border-radius: var(--radius-md); font-size: 0.95rem; background: var(--bg-subtle);" />
            </div>
          ` : ''}

          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-primary);">이메일 계정</label>
            <input type="email" id="auth-email" required placeholder="clinician@example.com"
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-hairline); border-radius: var(--radius-md); font-size: 0.95rem; background: var(--bg-subtle);" />
          </div>

          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-primary);">비밀번호 (8자 이상)</label>
            <input type="password" id="auth-password" required minlength="8" placeholder="••••••••"
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-hairline); border-radius: var(--radius-md); font-size: 0.95rem; background: var(--bg-subtle);" />
          </div>

          ${mode === 'signup' ? `
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-hairline); cursor: pointer; line-height: 1.45;">
              <input type="checkbox" id="auth-consent" required style="margin-top: 0.2rem; accent-color: var(--color-accent);" />
              <span>
                <strong>[필수] 환자 민감정보 보호 및 음성인식 고지 확인:</strong>
                환자 등록 시 가명/병록번호 사용을 권장하며, 자동 음성인식(STT) 사용 시 브라우저 음성 서버를 경유함을 확인합니다.
              </span>
            </label>
          ` : ''}

          <button type="submit" class="btn btn-primary btn-pill shadow-glow" ${isSubmitting || !isCloudConfigured ? 'disabled' : ''}
            style="padding: 0.85rem; font-weight: 700; font-size: 1rem; width: 100%; margin-top: 0.4rem;">
            ${isSubmitting ? '인증 처리 중...' : (mode === 'login' ? '클라우드 워크스페이스 로그인' : '치료사 계정 생성 및 시작')}
          </button>
        </form>

        <hr style="margin: 1.8rem 0; border: none; border-top: 1px solid var(--border-hairline);" />

        <!-- 오프라인 단독 사용 진입 버튼 -->
        <div style="text-align: center;">
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 0 0 0.75rem 0;">
            ${isCloudConfigured
              ? '인터넷 연결이 없는 방문재활 환경이신가요?'
              : '현재 서버 환경변수(SUPABASE_URL) 미설정 상태입니다. 오프라인 모드로 즉시 사용 가능합니다.'}
          </p>
          <button type="button" id="btn-offline-mode" class="btn btn-secondary btn-pill" style="width: 100%; padding: 0.75rem; font-weight: 700; font-size: 0.92rem;">
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
