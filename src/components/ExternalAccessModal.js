// ==========================================================================
//  외부 및 태블릿 접속 안내 모달 (ExternalAccessModal.js) - 런타임 오류 해결 및 디자인 정비
// ==========================================================================

import { icon } from '../utils/icons.js';
import { toast } from '../utils/helpers.js';

export function openExternalAccessModal(container) {
  const currentHost = window.location.hostname || 'localhost';
  const currentPort = window.location.port || '3000';
  const protocol = window.location.protocol;

  const localUrl = `${protocol}//${currentHost}:${currentPort}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(localUrl)}`;

  container.innerHTML = `
    <div class="modal-overlay show" id="external-access-overlay">
      <div class="modal" style="max-width: 580px;">
        <div class="modal-head">
          <div class="modal-title">
            <span class="icon-chip">${icon('wifi', 18)}</span>
            <h3>태블릿 및 원격 접속 안내</h3>
          </div>
          <button class="btn-icon" id="btn-close-external-top">${icon('x', 18)}</button>
        </div>

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- 1. Vercel 상시 공인 HTTPS 접속 카드 -->
          <div style="background: var(--brand-success-light); border: 1.5px solid var(--brand-success-border); padding: 1.25rem; border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem;">
                <span style="background: var(--brand-success); color: white; font-size: 0.75rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 9999px;">상시 오픈</span>
                <strong style="color: #065F46; font-size: 1.05rem;">
                  🌐 공식 클라우드 (Vercel) 영구 접속 주소
                </strong>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.6rem;">
                PC가 꺼져 있어도 언제 어디서든 스마트폰/태블릿으로 즉시 접속 가능합니다.
              </p>
              
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <code style="background: white; border: 1px solid var(--border-medium); color: var(--brand-primary); padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.95rem; font-weight: 800; flex: 1;">
                  https://unirehab-speech.vercel.app
                </code>
                <button class="btn btn-primary" id="btn-copy-vercel-url" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                  복사
                </button>
              </div>
            </div>

            <!-- QR 코드 이미지 -->
            <div style="text-align: center; background: white; padding: 0.5rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Funirehab-speech.vercel.app" alt="Vercel 접속 QR코드" style="width: 100px; height: 100px; display: block;">
              <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">태블릿 카메라 스캔</span>
            </div>
          </div>

          <!-- 2. 로컬 와이파이 다이렉트 접속 카드 -->
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); padding: 1rem 1.25rem; border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 220px;">
              <strong style="color: var(--text-primary); font-size: 0.95rem; display: block; margin-bottom: 0.2rem;">
                💻 원내/가정 동일 Wi-Fi 로컬 PC 직결
              </strong>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <code style="background: white; border: 1px solid var(--border-light); color: var(--text-secondary); padding: 0.35rem 0.7rem; border-radius: var(--radius-sm); font-size: 0.85rem; flex: 1;">
                  ${localUrl}
                </code>
                <button class="btn btn-secondary" id="btn-copy-local-url" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
                  복사
                </button>
              </div>
            </div>
          </div>

          <!-- PWA 전체화면 앱 설치 가이드 -->
          <div style="background: var(--brand-success-light); border: 1.5px solid var(--brand-success-border); padding: 1rem 1.25rem; border-radius: var(--radius-lg); font-size: 0.9rem; color: #065F46; line-height: 1.5;">
            ✨ <strong>태블릿 전용 앱(PWA)으로 띄우기</strong><br>
            태블릿 브라우저(사파리 또는 크롬) 메뉴에서 <strong>[홈 화면에 추가]</strong>를 누르시면 상단 주소창이 사라진 깔끔한 풀스크린 재활 전용 앱으로 동작합니다.
          </div>

        </div>

        <div class="modal-foot">
          <button class="btn btn-primary" id="btn-close-external-foot">확인 및 닫기</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { container.innerHTML = ''; };
  container.querySelector('#btn-close-external-top').onclick = close;
  container.querySelector('#btn-close-external-foot').onclick = close;
  container.querySelector('#external-access-overlay').onclick = (e) => {
    if (e.target.id === 'external-access-overlay') close();
  };

  container.querySelector('#btn-copy-local-url').onclick = () => {
    navigator.clipboard.writeText(localUrl).then(() => {
      toast('로컬 접속 주소가 클립보드에 복사되었습니다.', 'success');
    });
  };

  const btnCopyVercel = container.querySelector('#btn-copy-vercel-url');
  if (btnCopyVercel) {
    btnCopyVercel.onclick = () => {
      navigator.clipboard.writeText('https://unirehab-speech.vercel.app').then(() => {
        toast('공식 Vercel 주소가 복사되었습니다.', 'success');
      });
    };
  }
}
