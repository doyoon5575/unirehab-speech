// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - 메인 진입점 (main.js)
// ==========================================================================

import { store } from './store.js';
import { renderHeader } from './components/Header.js';
import { renderClinicianView } from './components/ClinicianView.js';
import { renderPatientView } from './components/PatientView.js';
import { renderReportView } from './components/ReportView.js';
import { openExternalAccessModal } from './components/ExternalAccessModal.js';
import { openSettingsModal } from './components/SettingsModal.js';

class App {
  constructor() {
    this.currentView = 'clinician'; // 'clinician' | 'patient' | 'report'
    this.sessionConfig = null;
    this.headerContainer = document.getElementById('main-header');
    this.contentContainer = document.getElementById('main-content');
    this.modalContainer = document.getElementById('modal-container');

    this.init();
  }

  init() {
    // 1. 테마 및 글자 접근성 세팅 적용
    store.applySettingsToDOM();

    // 2. 화면 렌더링
    this.render();

    // 3. 스토어 구독 (환자 변경 등 이벤트 감지)
    store.subscribe((event) => {
      if (event === 'PATIENT_CHANGED' || event === 'PATIENTS_UPDATED') {
        this.render();
      }
    });
  }

  // 뷰 라우팅 내비게이션
  navigate(viewName, config = null) {
    this.currentView = viewName;
    if (config) this.sessionConfig = config;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  render() {
    // 1. 상단 글로벌 헤더 렌더링
    renderHeader(
      this.headerContainer,
      this.currentView,
      (newView) => this.navigate(newView),
      () => openExternalAccessModal(this.modalContainer),
      () => openSettingsModal(this.modalContainer)
    );

    // 2. 메인 뷰 컨텐츠 라우팅
    this.contentContainer.innerHTML = '';

    switch (this.currentView) {
      case 'clinician':
        renderClinicianView(this.contentContainer, (cfg) => {
          this.navigate('patient', cfg);
        });
        break;

      case 'patient':
        renderPatientView(
          this.contentContainer,
          this.sessionConfig,
          () => this.navigate('report')
        );
        break;

      case 'report':
        renderReportView(this.contentContainer);
        break;

      default:
        this.navigate('clinician');
    }
  }
}

// 애플리케이션 인스턴스 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.unirehabApp = new App();
});
