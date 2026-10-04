// ==========================================================================
//  접근성 및 시스템 설정 모달 (SettingsModal.js)
//  - 글자 크기 3단계, 고대비 모드, TTS 발화 속도, JSON 데이터 백업/복원
// ==========================================================================

import { store } from '../store.js';
import { icon } from '../utils/icons.js';
import { toast, downloadFile } from '../utils/helpers.js';

export function openSettingsModal(container) {
  const settings = store.getSettings();

  container.innerHTML = `
    <div class="modal-overlay show" id="settings-overlay">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-head">
          <div class="modal-title">
            <span class="icon-chip">${icon('settings', 18)}</span>
            <h3>접근성 및 환경 설정</h3>
          </div>
          <button class="btn-icon" id="btn-close-settings-modal">${icon('x', 18)}</button>
        </div>

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- 글자 크기 3단계 -->
          <div>
            <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">
              화면 글자 크기 (시인성)
            </label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;" id="font-size-group">
              <button class="btn btn-secondary font-opt-btn ${settings.fontSize === 'text-md' ? 'active' : ''}" data-val="text-md" style="font-size: 0.9rem; border-width: 2px; ${settings.fontSize === 'text-md' ? 'border-color: var(--brand-primary); background: var(--brand-primary-light); color: var(--brand-primary); font-weight: 800;' : ''}">
                보통 (16px)
              </button>
              <button class="btn btn-secondary font-opt-btn ${settings.fontSize === 'text-lg' ? 'active' : ''}" data-val="text-lg" style="font-size: 1rem; border-width: 2px; ${settings.fontSize === 'text-lg' ? 'border-color: var(--brand-primary); background: var(--brand-primary-light); color: var(--brand-primary); font-weight: 800;' : ''}">
                크게 (18px)
              </button>
              <button class="btn btn-secondary font-opt-btn ${settings.fontSize === 'text-xl' ? 'active' : ''}" data-val="text-xl" style="font-size: 1.15rem; border-width: 2px; ${settings.fontSize === 'text-xl' ? 'border-color: var(--brand-primary); background: var(--brand-primary-light); color: var(--brand-primary); font-weight: 800;' : ''}">
                아주 크게 (20px)
              </button>
            </div>
          </div>

          <!-- 고대비 모드 토글 -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
            <div>
              <strong style="font-size: 0.95rem; display: block;">고대비 모드 (High Contrast)</strong>
              <span style="font-size: 0.8rem; color: var(--text-muted);">시각적 피로 감소 및 명도 대비 극대화</span>
            </div>
            <label style="cursor: pointer;">
              <input type="checkbox" id="check-high-contrast" ${settings.highContrast ? 'checked' : ''} style="width: 22px; height: 22px; accent-color: var(--brand-primary);">
            </label>
          </div>

          <!-- 음성 발화 (TTS) 안내 속도 -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
              <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary);">
                음성 낭독 속도 (TTS Rate)
              </label>
              <span id="label-speech-rate" style="font-size: 0.85rem; font-weight: 700; color: var(--brand-primary);">
                ${settings.speechRate || 1.0}x
              </span>
            </div>
            <input type="range" id="range-speech-rate" min="0.7" max="1.3" step="0.1" value="${settings.speechRate || 1.0}" style="width: 100%; accent-color: var(--brand-primary);">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
              <span>느리게 (0.7x)</span>
              <span>보통 (1.0x)</span>
              <span>빠르게 (1.3x)</span>
            </div>
          </div>

          <!-- 데이터 백업 및 복원 -->
          <div style="border-top: 1px solid var(--border-light); padding-top: 1rem;">
            <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">
              데이터 영구 보관 및 이전
            </label>
            <div style="display: flex; gap: 0.6rem;">
              <button class="btn btn-secondary" id="btn-export-backup" style="flex: 1; font-size: 0.85rem;">
                ${icon('download', 14)} 백업 파일 다운로드
              </button>
              <label class="btn btn-secondary" style="flex: 1; font-size: 0.85rem; cursor: pointer;">
                ${icon('upload', 14)} 백업 복원
                <input type="file" id="file-import-backup" accept=".json" style="display: none;">
              </label>
            </div>
          </div>

        </div>

        <div class="modal-foot">
          <button class="btn btn-primary" id="btn-close-settings-bottom">설정 완료</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { container.innerHTML = ''; };
  container.querySelector('#btn-close-settings-modal').onclick = close;
  container.querySelector('#btn-close-settings-bottom').onclick = close;
  container.querySelector('#settings-overlay').onclick = (e) => {
    if (e.target.id === 'settings-overlay') close();
  };

  // 글자 크기 변경
  container.querySelectorAll('.font-opt-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      store.updateSettings({ fontSize: val });
      openSettingsModal(container); // 화면 갱신
    };
  });

  // 고대비 변경
  container.querySelector('#check-high-contrast').onchange = (e) => {
    store.updateSettings({ highContrast: e.target.checked });
  };

  // TTS 속도 슬라이더
  const rangeRate = container.querySelector('#range-speech-rate');
  const labelRate = container.querySelector('#label-speech-rate');
  rangeRate.oninput = (e) => {
    const val = parseFloat(e.target.value);
    labelRate.textContent = `${val.toFixed(1)}x`;
  };
  rangeRate.onchange = (e) => {
    const val = parseFloat(e.target.value);
    store.updateSettings({ speechRate: val });
  };

  // 백업 다운로드
  container.querySelector('#btn-export-backup').onclick = () => {
    const jsonStr = store.exportBackupJSON();
    downloadFile(jsonStr, `UniRehab_백업데이터_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    toast('백업 파일이 안전하게 저장되었습니다.', 'success');
  };

  // 백업 복원
  container.querySelector('#file-import-backup').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const success = store.importBackupJSON(evt.target.result);
      if (success) {
        toast('데이터가 성공적으로 복원되었습니다.', 'success');
        close();
        window.location.reload();
      } else {
        toast('백업 파일 형식이 올바르지 않습니다.', 'error');
      }
    };
    reader.readAsText(file);
  };
}
