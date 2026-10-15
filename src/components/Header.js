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
        <!-- 미니멀 브랜드 로고 및 타이틀 -->
        <div class="brand-logo-area" id="header-brand-logo">
          <div class="logo-badge">
            ${icon('logo', 20, 2.2)}
          </div>
          <div class="brand-text">
            <h1>유니원 리햅 <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; border: 1px solid var(--border-light); padding: 0.1rem 0.35rem; border-radius: 4px; margin-left: 0.35rem; letter-spacing: 0.04em;">PRO</span></h1>
            <div class="brand-sub">성인 언어재활 솔루션</div>
          </div>
        </div>

        <!-- 중앙 메인 탭 내비게이션 -->
        <nav class="nav-tabs" aria-label="메인 메뉴">
          <button class="nav-tab-btn ${currentView === 'clinician' ? 'active' : ''}" data-view="clinician">
            ${icon('dashboard', 15)}
            <span>치료사 관리</span>
          </button>
          <button class="nav-tab-btn ${currentView === 'patient' ? 'active' : ''}" data-view="patient">
            ${icon('play', 15)}
            <span>재활 훈련실</span>
          </button>
          <button class="nav-tab-btn ${currentView === 'report' ? 'active' : ''}" data-view="report">
            ${icon('chart', 15)}
            <span>임상 리포트</span>
          </button>
        </nav>

        <!-- 우측 활성 대상자 정보 및 유틸리티 도구 -->
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <!-- 활성 환자 칩 (클릭 시 환자 전환) -->
          <div class="patient-badge-card" id="btn-patient-quick-switch" title="대상자 전환">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--brand-success);"></span>
            <strong style="color: var(--text-primary); font-size: 0.85rem;">${esc(patient.name)}</strong>
            <span style="color: var(--text-muted); font-size: 0.78rem;">(${esc(patient.gender[0])}/${esc(patient.age)})</span>
            ${icon('chevronDown', 12, 2)}
          </div>

          <!-- 원격/외부 접속 가이드 버튼 -->
          <button class="btn-icon" id="btn-open-external" title="태블릿/외부 접속 (QR코드)">
            ${icon('wifi', 16)}
          </button>

          <!-- 글자 크기 / 고대비 / 설정 모달 -->
          <button class="btn-icon" id="btn-open-settings" title="접근성 및 시스템 설정">
            ${icon('settings', 16)}
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
            ${esc(p.name)} <span style="font-weight: 500; font-size: 0.85rem; color: var(--text-muted);">${esc(p.gender)}, ${esc(p.age)}세</span>
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
            <button class="btn btn-secondary" id="btn-open-new-patient" style="width: 100%; margin-top: 0.5rem; border-style: dashed;">
              ${icon('plus', 16)} 신규 대상자 등록
            </button>
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

    modalBox.querySelector('#btn-open-new-patient').onclick = () => openNewPatientModal();
  }

  function openNewPatientModal() {
    const modalBox = document.getElementById('modal-container');
    const field = 'width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem; background:white;';
    const label = 'font-size:0.85rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:0.2rem;';
    modalBox.innerHTML = `
      <div class="modal-overlay show">
        <div class="modal" style="max-width: 520px;">
          <div class="modal-head">
            <div class="modal-title"><span class="icon-chip">${icon('plus', 18)}</span><h3>신규 대상자 등록</h3></div>
            <button class="btn-icon" id="np-close">${icon('x', 18)}</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:0.9rem;">
            <div><label style="${label}">성명 *</label><input id="np-name" style="${field}" placeholder="예: 홍길동"></div>
            <div style="display:flex; gap:0.8rem;">
              <div style="flex:1;"><label style="${label}">연령 *</label><input id="np-age" type="number" min="3" max="120" style="${field}"></div>
              <div style="flex:1;"><label style="${label}">성별</label><select id="np-gender" style="${field}"><option>남성</option><option>여성</option></select></div>
            </div>
            <div><label style="${label}">진단명 *</label><input id="np-diagnosis" style="${field}" placeholder="예: 뇌경색 후 브로카 실어증"></div>
            <div style="display:flex; gap:0.8rem;">
              <div style="flex:1;"><label style="${label}">발병일</label><input id="np-onset" type="date" style="${field}"></div>
              <div style="flex:1;"><label style="${label}">중증도</label><select id="np-severity" style="${field}">
                <option>경도 (Mild)</option><option>경중등도 (Mild-Moderate)</option><option selected>중등도 (Moderate)</option><option>중도 (Severe)</option></select></div>
            </div>
            <div style="display:flex; gap:0.8rem;">
              <div style="flex:1;"><label style="${label}">목표 영역</label><select id="np-domain" style="${field}">
                <option value="naming">어휘 인출</option><option value="sentence">문장 완성</option><option value="auditory">청각 이해</option><option value="pragmatics">일상 화용</option></select></div>
              <div style="flex:1;"><label style="${label}">시작 난이도</label><select id="np-level" style="${field}">
                <option value="level1">1단계 · 기초</option><option value="level2">2단계 · 중급</option><option value="level3">3단계 · 심화</option></select></div>
            </div>
            <div><label style="${label}">단기 치료목표 (STG)</label><textarea id="np-stg" rows="2" style="${field}"></textarea></div>
            <div><label style="${label}">장기 치료목표 (LTG)</label><textarea id="np-ltg" rows="2" style="${field}"></textarea></div>
            <div id="np-error" style="display:none; color: var(--brand-danger); font-size: 0.85rem; font-weight: 700;"></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-secondary" id="np-cancel">취소</button>
            <button class="btn btn-primary" id="np-save">등록</button>
          </div>
        </div>
      </div>`;

    const close = () => { modalBox.innerHTML = ''; };
    modalBox.querySelector('#np-close').onclick = close;
    modalBox.querySelector('#np-cancel').onclick = close;
    modalBox.querySelector('#np-save').onclick = () => {
      const v = (id) => modalBox.querySelector(id).value.trim();
      const name = v('#np-name');
      const age = parseInt(v('#np-age'), 10);
      const diagnosis = v('#np-diagnosis');
      const err = modalBox.querySelector('#np-error');
      if (!name || !diagnosis || !(age >= 3 && age <= 120)) {
        err.style.display = 'block';
        err.textContent = '성명, 연령(3~120세), 진단명은 필수입니다.';
        return;
      }
      close();
      store.addPatient({
        name, age, gender: v('#np-gender'), diagnosis,
        onsetDate: v('#np-onset') || '-',
        severity: v('#np-severity'),
        targetDomain: v('#np-domain'),
        difficulty: v('#np-level'),
        goals: { ltg: v('#np-ltg'), stg: v('#np-stg') },
        notes: ''
      });
    };
  }
}
