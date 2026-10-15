// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - 메인 엔트리 및 인증/동기화 라우터 (main.js)
// ==========================================================================
import { store } from './store.js';
import { renderHeader } from './components/Header.js';
import { renderAuthView } from './components/AuthView.js';
import { renderClinicianView } from './components/ClinicianView.js';
import { renderPatientView } from './components/PatientView.js';
import { renderReportView } from './components/ReportView.js';
import { openExternalAccessModal } from './components/ExternalAccessModal.js';
import { openSettingsModal } from './components/SettingsModal.js';
import { speechAgent } from './agents/speechAgent.js';
import './utils/reliableSpeech.js';

class App {
  constructor() {
    this.currentView = 'clinician';
    this.sessionConfig = null;
    this.headerContainer = document.getElementById('main-header');
    this.contentContainer = document.getElementById('main-content');
    this.modalContainer = document.getElementById('modal-container');
    this.init();
  }

  init() {
    store.applySettingsToDOM();
    this.render();

    store.subscribe(event => {
      if (event === 'PATIENT_CHANGED' || event === 'PATIENTS_UPDATED' || event === 'AUTH_CHANGED') {
        if (this.currentView === 'patient') {
          speechAgent.stopListening();
          speechAgent.cancelSpeech();
          this.currentView = 'clinician';
          this.sessionConfig = null;
        }
        this.render();
      } else if (event === 'SYNC_STATUS_CHANGED' || event === 'CUSTOM_TASKS_UPDATED') {
        this.updateSyncBadge();
      }
    });

    window.addEventListener('pagehide', () => {
      speechAgent.stopListening();
      speechAgent.cancelSpeech();
    });
  }

  navigate(viewName, config = null) {
    if (this.currentView === 'patient' && viewName !== 'patient') {
      speechAgent.stopListening();
      speechAgent.cancelSpeech();
    }
    this.currentView = viewName;
    if (config) this.sessionConfig = config;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateSyncBadge() {
    const badgeEl = document.getElementById('cloud-sync-indicator');
    if (!badgeEl) return;

    const pendingCount = (store.syncQueue || []).length;
    if (store.authMode === 'offline') {
      badgeEl.textContent = '💻 로컬 오프라인 모드';
      badgeEl.style.background = '#f1f5f9';
      badgeEl.style.color = '#475569';
      badgeEl.style.border = '1px solid #cbd5e1';
    } else if (!navigator.onLine || store.syncStatus === 'OFFLINE') {
      badgeEl.textContent = `⚡ 오프라인 임시저장 (대기 ${pendingCount}건)`;
      badgeEl.style.background = '#fef3c7';
      badgeEl.style.color = '#b45309';
      badgeEl.style.border = '1px solid #fde68a';
    } else if (store.syncStatus === 'SYNCING') {
      badgeEl.textContent = '🔄 클라우드 동기화 중...';
      badgeEl.style.background = '#e0f2fe';
      badgeEl.style.color = '#0369a1';
      badgeEl.style.border = '1px solid #bae6fd';
    } else {
      badgeEl.textContent = pendingCount > 0 ? `☁️ 동기화 대기 (${pendingCount}건)` : '☁️ 클라우드 실시간 보호 중';
      badgeEl.style.background = '#dcfce7';
      badgeEl.style.color = '#15803d';
      badgeEl.style.border = '1px solid #bbf7d0';
    }
  }

  render() {
    // 클라우드 설정이 존재하고 아직 로그인/오프라인 선택을 하지 않은 경우 로그인 화면 표시
    if (!store.isAuthenticated()) {
      this.headerContainer.innerHTML = '';
      renderAuthView(this.contentContainer, () => this.navigate('clinician'));
      return;
    }

    renderHeader(
      this.headerContainer,
      this.currentView,
      view => this.navigate(view),
      () => openExternalAccessModal(this.modalContainer),
      () => openSettingsModal(this.modalContainer)
    );

    // 헤더 내 실시간 동기화 상태 배지 삽입
    let badge = document.getElementById('cloud-sync-indicator');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'cloud-sync-indicator';
      badge.style.cssText = 'font-size: 0.78rem; font-weight: 700; padding: 0.3rem 0.65rem; border-radius: 999px; margin-left: 0.5rem; display: inline-flex; align-items: center; transition: all 0.2s;';
      const targetHeader = this.headerContainer.querySelector('.header-right, .header-inner, header, div');
      if (targetHeader) {
        targetHeader.appendChild(badge);
      }
    }
    this.updateSyncBadge();

    this.contentContainer.innerHTML = '';
    switch (this.currentView) {
      case 'clinician':
        renderClinicianView(this.contentContainer, cfg => this.navigate('patient', cfg));
        break;
      case 'patient':
        renderPatientView(this.contentContainer, this.sessionConfig, () => this.navigate('report'));
        break;
      case 'report':
        renderReportView(this.contentContainer);
        break;
      default:
        this.navigate('clinician');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.unirehabApp = new App();
});
