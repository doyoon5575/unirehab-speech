// ==========================================================================
//  치료사 관리 뷰 컴포넌트 (ClinicianView.js)
//  - KPI 진척 지표, InsightAgent AI 임상 브리핑 알림
//  - 대상자 프로필 & LTG/STG 목표 설정
//  - 맞춤형 세션 설계기 (적응형 ON/OFF, 문항 수, 난이도 권고)
// ==========================================================================

import { store } from '../store.js';
import { icon } from '../utils/icons.js';
import { DOMAINS, LEVELS, domainName, levelName, esc, sec } from '../utils/helpers.js';
import { insightAgent } from '../agents/insightAgent.js';
import { adaptiveAgent } from '../agents/adaptiveAgent.js';
import { taskAgent } from '../agents/taskAgent.js';

export function renderClinicianView(container, onStartSession) {
  const patient = store.getActivePatient();
  const patients = store.getPatients();
  const sessions = store.getSessions(patient.id);
  const allSessions = store.getSessions();

  // AI 임상 인사이트 분석
  const insightReport = insightAgent.analyze(patient, sessions);
  const taskStats = taskAgent.stats();

  // 적응형 차기 난이도 권고 계산
  const adaptRec = adaptiveAgent.recommend(sessions, patient.targetDomain, patient.difficulty);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- 상단 인사이트 배너 (InsightAgent) -->
      ${renderInsightAlerts(insightReport.insights)}

      <!-- 핵심 KPI 카드 그리드 -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">
            <span>총 재활 회기</span>
            <span class="icon-chip" style="width:28px;height:28px;">${icon('calendar', 14)}</span>
          </div>
          <div class="kpi-value">${sessions.length}<span style="font-size: 1rem; font-weight: 500; margin-left: 2px;">회</span></div>
          <div class="kpi-sub">최근 회기: ${sessions.length ? sessions[sessions.length - 1].date : '기록 없음'}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>목표 영역 정반응률</span>
            <span class="icon-chip" style="width:28px;height:28px; background:var(--brand-success-light); color:var(--brand-success);">${icon('target', 14)}</span>
          </div>
          <div class="kpi-value" style="color:var(--brand-success);">
            ${insightReport.summary.recentAccuracy !== null ? insightReport.summary.recentAccuracy : 0}<span style="font-size: 1rem; font-weight: 500; margin-left: 2px;">%</span>
          </div>
          <div class="kpi-sub">
            ${insightReport.summary.stg.achieved 
              ? '🎯 단기목표(80%) 도달 완수' 
              : `STG 기준: ${insightReport.summary.stg.streak}/3회기 연속 달성`}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>평균 반응 잠복기</span>
            <span class="icon-chip" style="width:28px;height:28px;">${icon('clock', 14)}</span>
          </div>
          <div class="kpi-value">
            ${sessions.length ? sec(sessions[sessions.length - 1].avgLatencyMs || 0) : '0.0'}<span style="font-size: 1rem; font-weight: 500; margin-left: 2px;">초</span>
          </div>
          <div class="kpi-sub">
            ${insightReport.summary.latSlope < 0 ? '⚡ 직전 대비 인출 속도 단축 중' : '안정적 인출 잠복기 유지'}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>자체 구성 문항 은행</span>
            <span class="icon-chip" style="width:28px;height:28px; background:var(--brand-purple-light); color:var(--brand-purple);">${icon('book', 14)}</span>
          </div>
          <div class="kpi-value" style="color:var(--brand-purple);">96<span style="font-size: 1rem; font-weight: 500; margin-left: 2px;">문항</span></div>
          <div class="kpi-sub">4개 영역 × 3단계 위계 체계</div>
        </div>
      </div>

      <!-- 메인 2분할 레이아웃: 좌측 대상자 정보/목표, 우측 세션 설계기 -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;">
        
        <!-- [좌측] 대상자 임상 프로필 및 치료 목표 관리 -->
        <div class="card" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="icon-chip">${icon('user', 18)}</span>
              <h3 style="font-size: 1.15rem;">대상자 임상 프로필</h3>
            </div>
            <button class="btn btn-secondary" id="btn-edit-patient-profile" style="padding: 0.35rem 0.75rem; font-size: 0.85rem;">
              ${icon('edit', 14)} 수정
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">성명 / 연령 / 성별</span>
              <strong>${esc(patient.name)} (${esc(patient.age)}세, ${esc(patient.gender)})</strong>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">임상 진단명</span>
              <span style="text-align: right; font-weight: 600; max-width: 65%; color: var(--brand-primary);">${esc(patient.diagnosis)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">발병일 (Onset)</span>
              <span>${esc(patient.onsetDate)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">장애 중증도</span>
              <span style="background: var(--bg-subtle); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">${esc(patient.severity)}</span>
            </div>
          </div>

          <!-- LTG & STG 치료 목표 상자 -->
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-primary); display: flex; align-items: center; gap: 0.4rem;">
              ${icon('award', 16)} 장기 치료목표 (LTG)
            </div>
            <p style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.45;">
              ${esc(patient.goals?.ltg || '설정된 장기 목표가 없습니다.')}
            </p>

            <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-success); margin-top: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
              ${icon('target', 16)} 단기 치료목표 (STG)
            </div>
            <p style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.45;">
              ${esc(patient.goals?.stg || '설정된 단기 목표가 없습니다.')}
            </p>
          </div>

          <!-- 임상 특이사항 메모 -->
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">임상 관찰 및 반응성 특이사항</span>
            <div style="font-size: 0.85rem; color: var(--text-secondary); background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 0.75rem;">
              ${esc(patient.notes || '기록된 특이사항이 없습니다.')}
            </div>
          </div>
        </div>

        <!-- [우측] 스마트 세션 설계기 (Session Builder) -->
        <div class="card" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="icon-chip">${icon('cpu', 18)}</span>
              <h3 style="font-size: 1.15rem;">스마트 세션 설계기</h3>
            </div>
            <span style="font-size: 0.8rem; color: var(--brand-primary); font-weight: 700; background: var(--brand-primary-light); padding: 0.2rem 0.5rem; border-radius: var(--radius-full);">
              Adaptive AI
            </span>
          </div>

          <!-- 훈련 영역 선택 -->
          <div>
            <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
              1. 목표 재활 영역
            </label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;" id="domain-select-group">
              ${Object.values(DOMAINS).map(d => `
                <button class="btn btn-secondary domain-opt-btn ${patient.targetDomain === d.id ? 'active' : ''}" data-domain="${d.id}" style="justify-content: flex-start; padding: 0.75rem; border-width: 2px; ${patient.targetDomain === d.id ? 'border-color: var(--brand-primary); background: var(--brand-primary-light); color: var(--brand-primary);' : ''}">
                  <span style="font-size: 1.1rem; margin-right: 0.3rem;">${icon(d.icon, 18)}</span>
                  <div style="text-align: left;">
                    <div style="font-weight: 700; font-size: 0.95rem;">${d.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${taskStats[d.id]?.total || 0}문항 보유</div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 시작 난이도 및 적응형 추천 알림 -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary);">
                2. 시작 난이도
              </label>
              <span style="font-size: 0.8rem; color: var(--brand-success); font-weight: 600;">
                AI 추천: ${levelName(adaptRec.level)}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;" id="difficulty-select-group">
              ${Object.values(LEVELS).map(lvl => `
                <button class="btn btn-secondary diff-opt-btn ${patient.difficulty === lvl.id ? 'active' : ''}" data-diff="${lvl.id}" style="padding: 0.6rem; border-width: 2px; ${patient.difficulty === lvl.id ? 'border-color: var(--brand-primary); background: var(--brand-primary-light); color: var(--brand-primary);' : ''}">
                  ${lvl.name} (${lvl.label})
                </button>
              `).join('')}
            </div>
            
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">
              💡 ${esc(adaptRec.reason)}
            </div>
          </div>

          <!-- 세션 문항 수 & 실시간 적응형 난이도 토글 -->
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 140px;">
              <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">
                문항 수 설정
              </label>
              <select id="select-task-count" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 0.95rem; font-weight: 600; background: white;">
                <option value="5">5 문항 (집중/피로 관리)</option>
                <option value="10" selected>10 문항 (임상 표준 회기)</option>
                <option value="15">15 문항 (심화 훈련)</option>
              </select>
            </div>

            <div style="flex: 1; min-width: 160px;">
              <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">
                실시간 적응형 난이도
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; height: 42px;">
                <input type="checkbox" id="check-adaptive-mode" checked style="width: 18px; height: 18px; accent-color: var(--brand-primary);">
                <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">수행 기반 자동 조절</span>
              </label>
            </div>
          </div>

          <!-- 훈련 세션 개시 버튼 -->
          <button class="btn btn-primary btn-large" id="btn-start-configured-session" style="margin-top: 0.5rem;">
            ${icon('play', 20, 2.5)}
            <span>선택된 설정으로 재활 세션 시작</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  bindClinicianEvents(container, patient, onStartSession);
}

// 상단 인사이트 알림 배너 렌더링
function renderInsightAlerts(insights) {
  if (!insights || !insights.length) return '';
  const topInsight = insights[0];

  const colors = {
    danger: { bg: 'var(--brand-danger-light)', border: 'var(--brand-danger-border)', text: '#991B1B', ico: 'alert' },
    warning: { bg: 'var(--brand-warning-light)', border: 'var(--brand-warning-border)', text: '#92400E', ico: 'alert' },
    success: { bg: 'var(--brand-success-light)', border: 'var(--brand-success-border)', text: '#065F46', ico: 'award' },
    info: { bg: 'var(--brand-primary-light)', border: '#BAE6FD', text: '#0369A1', ico: 'info' }
  }[topInsight.level] || { bg: 'var(--bg-subtle)', border: 'var(--border-light)', text: '#334155', ico: 'info' };

  return `
    <div style="background: ${colors.bg}; border: 1.5px solid ${colors.border}; border-radius: var(--radius-lg); padding: 1rem 1.4rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 0.8rem;">
        <span style="color: ${colors.text}; display: flex; align-items: center;">${icon(colors.ico, 20)}</span>
        <div>
          <strong style="color: ${colors.text}; font-size: 0.95rem;">AI 임상 브리핑: ${esc(topInsight.title)}</strong>
          <p style="font-size: 0.85rem; color: ${colors.text}; opacity: 0.95; margin-top: 0.1rem;">${esc(topInsight.body)}</p>
        </div>
      </div>
      <span style="font-size: 0.75rem; font-weight: 700; color: ${colors.text}; background: rgba(255,255,255,0.6); padding: 0.25rem 0.6rem; border-radius: 9999px; white-space: nowrap;">
        InsightAgent
      </span>
    </div>
  `;
}

function bindClinicianEvents(container, patient, onStartSession) {
  let selectedDomain = patient.targetDomain || 'naming';
  let selectedDiff = patient.difficulty || 'level2';

  // 1. 영역 선택
  container.querySelectorAll('.domain-opt-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.domain-opt-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.background = '';
        b.style.color = '';
      });
      btn.style.borderColor = 'var(--brand-primary)';
      btn.style.background = 'var(--brand-primary-light)';
      btn.style.color = 'var(--brand-primary)';
      selectedDomain = btn.getAttribute('data-domain');
    };
  });

  // 2. 난이도 선택
  container.querySelectorAll('.diff-opt-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.diff-opt-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.background = '';
        b.style.color = '';
      });
      btn.style.borderColor = 'var(--brand-primary)';
      btn.style.background = 'var(--brand-primary-light)';
      btn.style.color = 'var(--brand-primary)';
      selectedDiff = btn.getAttribute('data-diff');
    };
  });

  // 3. 세션 시작
  container.querySelector('#btn-start-configured-session').onclick = () => {
    const count = parseInt(container.querySelector('#select-task-count').value, 10);
    const adaptive = container.querySelector('#check-adaptive-mode').checked;

    onStartSession({
      domain: selectedDomain,
      difficulty: selectedDiff,
      count,
      adaptive
    });
  };

  // 4. 환자 프로필 수정 모달
  container.querySelector('#btn-edit-patient-profile').onclick = () => {
    openEditProfileModal(patient);
  };
}

function openEditProfileModal(patient) {
  const modalBox = document.getElementById('modal-container');
  modalBox.innerHTML = `
    <div class="modal-overlay show">
      <div class="modal" style="max-width: 520px;">
        <div class="modal-head">
          <div class="modal-title">
            <span class="icon-chip">${icon('edit', 18)}</span>
            <h3>대상자 프로필 및 치료 목표 수정</h3>
          </div>
          <button class="btn-icon" id="btn-close-edit-modal">${icon('x', 18)}</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">환자명</label>
            <input type="text" id="edit-pat-name" value="${esc(patient.name)}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
          </div>
          <div style="display:flex; gap:0.8rem;">
            <div style="flex:1;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">연령</label>
              <input type="number" id="edit-pat-age" value="${patient.age}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">성별</label>
              <select id="edit-pat-gender" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem; background:white;">
                <option value="남성" ${patient.gender === '남성' ? 'selected' : ''}>남성</option>
                <option value="여성" ${patient.gender === '여성' ? 'selected' : ''}>여성</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">진단명</label>
            <input type="text" id="edit-pat-diagnosis" value="${esc(patient.diagnosis)}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">장기 치료목표 (LTG)</label>
            <textarea id="edit-pat-ltg" rows="2" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(patient.goals?.ltg || '')}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">단기 치료목표 (STG)</label>
            <textarea id="edit-pat-stg" rows="2" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(patient.goals?.stg || '')}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">임상 특이사항</label>
            <textarea id="edit-pat-notes" rows="2" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(patient.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" id="btn-cancel-edit">취소</button>
          <button class="btn btn-primary" id="btn-save-edit">저장하기</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { modalBox.innerHTML = ''; };
  modalBox.querySelector('#btn-close-edit-modal').onclick = close;
  modalBox.querySelector('#btn-cancel-edit').onclick = close;

  modalBox.querySelector('#btn-save-edit').onclick = () => {
    const updated = {
      name: modalBox.querySelector('#edit-pat-name').value.trim() || patient.name,
      age: parseInt(modalBox.querySelector('#edit-pat-age').value, 10) || patient.age,
      gender: modalBox.querySelector('#edit-pat-gender').value,
      diagnosis: modalBox.querySelector('#edit-pat-diagnosis').value.trim() || patient.diagnosis,
      goals: {
        ltg: modalBox.querySelector('#edit-pat-ltg').value.trim(),
        stg: modalBox.querySelector('#edit-pat-stg').value.trim()
      },
      notes: modalBox.querySelector('#edit-pat-notes').value.trim()
    };

    store.updatePatient(patient.id, updated);
    close();
  };
}
