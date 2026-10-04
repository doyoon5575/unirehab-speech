// ==========================================================================
//  헤더 컴포넌트 (Header.js) - 밝고 세련된 임상 톤 & 접근성 스위처
// ==========================================================================

import { store } from '../store.js';
import { icon } from '../utils/icons.js';
import { esc } from '../utils/helpers.js';

export function renderHeader(container, currentView, onNavigate, onOpenExternalModal, onOpenSettingsModal) {
  const patient = store.getActivePatient();
  const settings = store.getSettings();

  container.innerHTML = `
    <div class="app-header">
      <div class="header-inner">
        <!-- 브랜드 로고 및 타이틀 -->
        <div class="brand-logo-area" id="header-brand-logo">
          <div class="logo-badge">
            ${icon('logo', 24, 2.2)}
          </div>
          <div class="brand-text">
            <h1>유니원 리햅 <span style="font-size: 0.75rem; color: var(--brand-primary); font-weight: 700; background: var(--brand-primary-light); padding: 0.15rem 0.4rem; border-radius: 4px; margin-left: 0.3rem;">v2.0 Pro</span></h1>
            <div class="brand-sub">Agentic AI 성인 언어재활 솔루션</div>
          </div>
        </div>

        <!-- 중앙 메인 탭 내비게이션 -->
        <nav class="nav-tabs" aria-label="메인 메뉴">
          <button class="nav-tab-btn ${currentView === 'clinician' ? 'active' : ''}" data-view="clinician">
            ${icon('dashboard', 17)}
            <span>치료사 관리</span>
          </button>
          <button class="nav-tab-btn ${currentView === 'patient' ? 'active' : ''}" data-view="patient">
            ${icon('play', 17)}
            <span>재활 훈련실</span>
          </button>
          <button class="nav-tab-btn ${currentView === 'report' ? 'active' : ''}" data-view="report">
            ${icon('chart', 17)}
            <span>임상 리포트</span>
          </button>
        </nav>

        <!-- 우측 활성 대상자 정보 및 유틸리티 도구 -->
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <!-- 활성 환자 칩 (클릭 시 환자 전환) -->
          <div class="patient-badge-card" id="btn-patient-quick-switch" title="대상자 전환">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--brand-success);"></span>
            <strong style="color: var(--text-primary);">${esc(patient.name)}</strong>
            <span style="color: var(--text-muted); font-size: 0.8rem;">(${esc(patient.gender[0])}/${esc(patient.age)})</span>
            ${icon('chevronDown', 14, 2.5)}
          </div>

          <!-- 원격/외부 접속 가이드 버튼 -->
          <button class="btn-icon" id="btn-open-external" title="태블릿/외부 접속 (QR코드)">
            ${icon('wifi', 18)}
          </button>

          <!-- 글자 크기 / 고대비 / 설정 모달 -->
          <button class="btn-icon" id="btn-open-settings" title="접근성 및 시스템 설정">
            ${icon('settings', 18)}
          </button>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  container.querySelector('#header-brand-logo').onclick = () => onNavigate('clinician');

  container.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const view = btn.getAttribute('data-view');
      onNavigate(view);
    };
  });

  container.querySelector('#btn-open-external').onclick = onOpenExternalModal;
  container.querySelector('#btn-open-settings').onclick = onOpenSettingsModal;

  // 환자 전환 드롭다운 모달
  container.querySelector('#btn-patient-quick-switch').onclick = () => {
    openPatientSwitchModal();
  };

  function openPatientSwitchModal() {
    const patients = store.getPatients();
    const activeId = patient.id;

    const listHtml = patients.map(p => `
      <div class="patient-switch-item" data-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.8rem 1rem; border-radius: var(--radius-md); border: 1.5px solid ${p.id === activeId ? 'var(--brand-primary)' : 'var(--border-light)'}; background: ${p.id === activeId ? 'var(--brand-primary-light)' : 'var(--bg-surface)'}; cursor: pointer; margin-bottom: 0.5rem; transition: var(--transition-fast);">
        <div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">
            ${esc(p.name)} <span style="font-weight: 500; font-size: 0.85rem; color: var(--text-muted);">${p.gender}, ${p.age}세</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
            ${esc(p.diagnosis)}
          </div>
        </div>
        ${p.id === activeId ? `<span style="color: var(--brand-primary); font-weight: 800; font-size: 0.85rem;">선택됨 ✓</span>` : ''}
      </div>
    `).join('');

    const modalBox = document.getElementById('modal-container');
    modalBox.innerHTML = `
      <div class="modal-overlay show">
        <div class="modal" style="max-width: 480px;">
          <div class="modal-head">
            <div class="modal-title">
              <span class="icon-chip">${icon('users', 18)}</span>
              <h3>재활 대상자 선택</h3>
            </div>
            <button class="btn-icon" id="btn-close-pat-switch">${icon('x', 18)}</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
              훈련 및 임상 차트를 열람할 대상 환자를 선택해 주세요.
            </p>
            ${listHtml}
          </div>
        </div>
      </div>
    `;

    const close = () => { modalBox.innerHTML = ''; };
    modalBox.querySelector('#btn-close-pat-switch').onclick = close;
    modalBox.querySelector('.modal-overlay').onclick = (e) => {
      if (e.target.classList.contains('modal-overlay')) close();
    };

    modalBox.querySelectorAll('.patient-switch-item').forEach(item => {
      item.onclick = () => {
        const id = item.getAttribute('data-id');
        store.setActivePatientId(id);
        close();
      };
    });
  }
}
