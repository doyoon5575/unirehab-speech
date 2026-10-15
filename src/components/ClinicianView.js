// ==========================================================================
//  치료사 관리 뷰 컴포넌트 (ClinicianView.js)
//  - KPI 진척 지표, InsightAgent AI 임상 브리핑 알림
//  - 대상자 프로필 & LTG/STG 목표 설정
//  - 맞춤형 세션 설계기 (적응형 ON/OFF, 문항 수, 난이도 권고)
// ==========================================================================

import { store } from '../store.js';
import { icon } from '../utils/icons.js';
import { DOMAINS, LEVELS, domainName, levelName, esc, sec, toast, downloadFile } from '../utils/helpers.js';
import { insightAgent } from '../agents/insightAgent.js';
import { adaptiveAgent } from '../agents/adaptiveAgent.js';
import { taskAgent } from '../agents/taskAgent.js';
import { openAITaskModal } from './AITaskModal.js';

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
      
      <!-- 상단 현장 실사용 바: 데이터 보관 및 음성인식 고지 -->
      <div style="display: flex; flex-direction: column; gap: 0.8rem; background: var(--bg-surface); padding: 1rem 1.25rem; border-radius: var(--radius-lg); border: 1.5px solid var(--border-light); box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.8rem;">
          <div style="display: flex; flex-direction: column; gap: 0.35rem; max-width: 820px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.3rem;">
                <span>🔒 데이터 보관 및 음성인식 고지</span>
              </span>
              <span style="font-size: 0.85rem; color: var(--text-primary); font-weight: 700;">
                환자 차트 및 회기 기록: 로컬 저장소 안전 보관 (외부 서버 미전송)
              </span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0; line-height: 1.45;">
              • <strong>데이터 보관:</strong> 차트 및 회기 기록은 브라우저 저장소에 보관됩니다. 공용 기기 사용 시 작업 후 백업 파일(JSON)로 내보낸 뒤 데이터를 정리하세요.<br/>
              • <strong>마이크 음성인식(STT) 주의:</strong> 자동 음성 채점 활성화 시 발화가 브라우저 제공사(Google/Apple/Microsoft) 음성 서버를 경유합니다. 민감한 환경에서는 <strong>[치료사 직접 채점 버튼]</strong>만 사용하시기 바랍니다.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${(patients || []).some(p => p.isDemo === true) ? `
              <button class="btn btn-secondary" id="btn-clear-demo-data" style="font-size: 0.82rem; padding: 0.4rem 0.85rem; border-color: #fca5a5; color: #b91c1c; background: #fff1f2; font-weight: 700;">
                🗑️ 데모 샘플 데이터 일괄 삭제
              </button>
            ` : ''}
            <button class="btn btn-secondary" id="btn-quick-export-backup" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">
              ${icon('download', 14)} <span>원클릭 백업 (JSON)</span>
            </button>
            <label class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.4rem 0.85rem; cursor: pointer; margin-bottom: 0;">
              ${icon('upload', 14)} <span>백업 복원</span>
              <input type="file" id="file-quick-import-backup" accept=".json" style="display: none;">
            </label>
          </div>
        </div>
      </div>

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
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.8rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="icon-chip">${icon('user', 18)}</span>
              <h3 style="font-size: 1.15rem;">대상자 프로필</h3>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary" id="btn-add-new-patient" style="padding: 0.35rem 0.75rem; font-size: 0.85rem; background: var(--brand-primary-light); color: var(--brand-primary); font-weight: 700; border-color: var(--brand-primary);">
                ${icon('plus', 14)} 신규 등록
              </button>
              <button class="btn btn-secondary" id="btn-edit-patient-profile" style="padding: 0.35rem 0.75rem; font-size: 0.85rem;">
                ${icon('edit', 14)} 수정
              </button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">성명 / 연령 / 성별</span>
              <strong>${esc(patient.name)} (${esc(patient.age)}세, ${esc(patient.gender)})</strong>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">진단명 / 교육 구분</span>
              <span style="text-align: right; font-weight: 600; max-width: 65%; color: var(--brand-primary);">${esc(patient.diagnosis)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">발병일 / 등록일</span>
              <span>${esc(patient.onsetDate || patient.createdDate || '-')}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span style="color: var(--text-muted);">장애 중증도</span>
              <span style="background: var(--bg-subtle); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">${esc(patient.severity)}</span>
            </div>
          </div>

          <!-- LTG & STG 치료 목표 상자 -->
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-primary); display: flex; align-items: center; gap: 0.4rem;">
              ${icon('award', 16)} 장기 목표 (LTG · 학기/최종 도달 목표)
            </div>
            <p style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.45;">
              ${esc(patient.goals?.ltg || '설정된 장기 목표가 없습니다.')}
            </p>

            <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-success); margin-top: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
              ${icon('target', 16)} 단기 목표 (STG · 회기 기준 80%)
            </div>
            <p style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.45;">
              ${esc(patient.goals?.stg || '설정된 단기 목표가 없습니다.')}
            </p>
          </div>

          <!-- 임상 특이사항 메모 -->
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">임상/교육 관찰 및 반응성 특이사항</span>
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

          <!-- 훈련 세션 개시 및 AI 문항 생성 버튼 -->
          <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btn-open-ai-generator" style="flex: 1; min-width: 220px; padding: 0.8rem; font-weight: 700; border-color: var(--brand-primary); color: var(--brand-primary); background: #f0f9ff;">
              ✨ 치료계획 기반 AI 맞춤 문항 생성 (${store.getCustomTasks().length}건 보유)
            </button>
            <button class="btn btn-primary btn-large" id="btn-start-configured-session" style="flex: 1.2; min-width: 240px;">
              ${icon('play', 20, 2.5)}
              <span>선택된 설정으로 재활 세션 시작</span>
            </button>
          </div>
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

  // 4. 원클릭 백업 다운로드
  container.querySelector('#btn-quick-export-backup').onclick = () => {
    const jsonStr = store.exportBackupJSON();
    downloadFile(jsonStr, `UniRehab_백업_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    toast('데이터가 백업 파일(JSON)로 저장되었습니다.', 'success');
  };

  // 5. 백업 파일 복원
  container.querySelector('#file-quick-import-backup').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const ok = store.importBackupJSON(ev.target.result);
        if (ok) {
          toast('백업 데이터가 성공적으로 복원되었습니다.', 'success');
          renderClinicianView(container, onStartSession);
        }
      } catch (err) {
        alert(err.message || '백업 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  };

  // 5-1. AI 맞춤 문항 생성 모달 열기
  const btnAiGen = container.querySelector('#btn-open-ai-generator');
  if (btnAiGen) {
    btnAiGen.onclick = () => {
      const modalContainer = document.getElementById('modal-container');
      openAITaskModal(modalContainer, (customSessionConfig) => {
        onStartSession(customSessionConfig);
      });
    };
  }

  // 5-2. 데모 데이터 일괄 삭제 버튼
  const btnClearDemo = container.querySelector('#btn-clear-demo-data');
  if (btnClearDemo) {
    btnClearDemo.onclick = () => {
      const confirmed = window.confirm(
        '초기 샘플 데이터(김철수, 이영희, 박민우 및 관련 샘플 회기)를 모두 삭제하시겠습니까?\n직접 등록하신 실제 대상자 기록은 안전하게 유지됩니다.'
      );
      if (confirmed) {
        store.clearDemoData();
        toast('데모 샘플 데이터가 모두 삭제되었습니다.', 'info');
        renderClinicianView(container, onStartSession);
      }
    };
  }

  // 6. 환자/학생 신규 등록 모달
  container.querySelector('#btn-add-new-patient').onclick = () => {
    openEditProfileModal(null, true);
  };

  // 7. 환자 프로필 수정 모달
  container.querySelector('#btn-edit-patient-profile').onclick = () => {
    openEditProfileModal(patient, false);
  };
}

function openEditProfileModal(patient, isNew = false) {
  const p = patient || {
    name: '',
    age: 60,
    gender: '남성',
    diagnosis: '언어재활 / 특수교육 훈련',
    severity: '경도 (Mild)',
    targetDomain: 'naming',
    difficulty: 'level2',
    goals: { ltg: '', stg: '' },
    notes: ''
  };

  const modalBox = document.getElementById('modal-container');
  modalBox.innerHTML = `
    <div class="modal-overlay show">
      <div class="modal" style="max-width: 520px;">
        <div class="modal-head">
          <div class="modal-title">
            <span class="icon-chip">${icon(isNew ? 'plus' : 'edit', 18)}</span>
            <h3>${isNew ? '신규 대상자 (학생·환자) 등록' : '대상자 프로필 및 목표 수정'}</h3>
          </div>
          <button class="btn-icon" id="btn-close-edit-modal">${icon('x', 18)}</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">이름 (성명)</label>
            <input type="text" id="edit-pat-name" placeholder="예: 홍길동" value="${esc(p.name)}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
          </div>
          <div style="display:flex; gap:0.8rem;">
            <div style="flex:1;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">연령 (만 나이)</label>
              <input type="number" id="edit-pat-age" value="${p.age}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">성별</label>
              <select id="edit-pat-gender" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem; background:white;">
                <option value="남성" ${p.gender === '남성' ? 'selected' : ''}>남성</option>
                <option value="여성" ${p.gender === '여성' ? 'selected' : ''}>여성</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">진단명 / 교육 구분</label>
            <input type="text" id="edit-pat-diagnosis" placeholder="예: 뇌졸중 후 실어증 / 성인전환기 언어발달" value="${esc(p.diagnosis)}" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.95rem;">
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">장기 목표 (LTG)</label>
            <textarea id="edit-pat-ltg" rows="2" placeholder="예: 일상생활 필수 어휘 80% 이상 자발적 산출" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(p.goals?.ltg || '')}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">단기 목표 (STG)</label>
            <textarea id="edit-pat-stg" rows="2" placeholder="예: 시각 자극 제시 시 3초 이내 목표 명사 인출률 80% 달성" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(p.goals?.stg || '')}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem; font-weight:700; color:var(--text-secondary);">임상/교육 관찰 특이사항</label>
            <textarea id="edit-pat-notes" rows="2" placeholder="특이사항 및 단서 반응성 메모" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1.5px solid var(--border-medium); font-size:0.9rem;">${esc(p.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" id="btn-cancel-edit">취소</button>
          <button class="btn btn-primary" id="btn-save-edit">${isNew ? '신규 등록 완료' : '저장하기'}</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { modalBox.innerHTML = ''; };
  modalBox.querySelector('#btn-close-edit-modal').onclick = close;
  modalBox.querySelector('#btn-cancel-edit').onclick = close;

  modalBox.querySelector('#btn-save-edit').onclick = () => {
    const nameVal = modalBox.querySelector('#edit-pat-name').value.trim();
    if (!nameVal) {
      toast('이름을 입력해 주세요.', 'error');
      return;
    }

    const payload = {
      name: nameVal,
      age: parseInt(modalBox.querySelector('#edit-pat-age').value, 10) || p.age,
      gender: modalBox.querySelector('#edit-pat-gender').value,
      diagnosis: modalBox.querySelector('#edit-pat-diagnosis').value.trim() || '미지정',
      severity: p.severity || '경도 (Mild)',
      targetDomain: p.targetDomain || 'naming',
      difficulty: p.difficulty || 'level2',
      goals: {
        ltg: modalBox.querySelector('#edit-pat-ltg').value.trim(),
        stg: modalBox.querySelector('#edit-pat-stg').value.trim()
      },
      notes: modalBox.querySelector('#edit-pat-notes').value.trim()
    };

    if (isNew) {
      store.addPatient(payload);
      toast(`${nameVal} 님이 신규 대상자로 등록되었습니다.`, 'success');
    } else {
      store.updatePatient(patient.id, payload);
      toast('프로필 정보가 수정되었습니다.', 'success');
    }
    close();
  };
}
