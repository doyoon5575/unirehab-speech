import { store } from './store.js';
import { renderHeader } from './components/Header.js';
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
      if (event === 'PATIENT_CHANGED' || event === 'PATIENTS_UPDATED') {
        if (this.currentView === 'patient') {
          speechAgent.stopListening();
          speechAgent.cancelSpeech();
          this.currentView = 'clinician';
          this.sessionConfig = null;
        }
        this.render();
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
  render() {
    renderHeader(this.headerContainer, this.currentView,
      view => this.navigate(view),
      () => openExternalAccessModal(this.modalContainer),
      () => openSettingsModal(this.modalContainer));
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
      default: this.navigate('clinician');
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  window.unirehabApp = new App();
});
