// ==========================================================================
//  임상 리포트 및 종단 분석 뷰 컴포넌트 (ReportView.js)
//  - 회기별 Chart.js 종단 추세 시각화 (정반응률, 잠복기)
//  - 단서 위계 분포 & 오류 유형 분석 바
//  - SOAP 임상 노트 실시간 인라인 편집 및 저장
//  - Excel 호환 CSV 다운로드 및 A4 공식 기록지 원클릭 인쇄
// ==========================================================================

import { store } from '../store.js';
import { reportAgent } from '../agents/reportAgent.js';
import { cueAgent, CUE_HIERARCHY } from '../agents/cueAgent.js';
import { ERROR_TYPES } from '../agents/evalAgent.js';
import { icon } from '../utils/icons.js';
import { domainName, levelName, esc, sec, downloadFile, toast } from '../utils/helpers.js';

export function renderReportView(container) {
  const patient = store.getActivePatient();
  const sessions = store.getSessions(patient.id);

  if (!sessions.length) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 4rem 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
        <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">기록된 재활 세션이 없습니다</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
          ${esc(patient.name)} 대상자의 훈련 세션을 먼저 진행해 주세요.
        </p>
        <button class="btn btn-primary" id="btn-goto-training">
          ${icon('play', 18)} 훈련 시작하기
        </button>
      </div>
    `;
    container.querySelector('#btn-goto-training').onclick = () => {
      window.unirehabApp.navigate('patient');
    };
    return;
  }

  // 최신 세션 기준
  const latestSession = sessions[sessions.length - 1];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- 상단 액션 바 (인쇄, CSV 내보내기) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800;">${esc(patient.name)} 대상자 임상 분석 리포트</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">
            누적 ${sessions.length}회기 수행 기록 · 최근 훈련일: ${latestSession.date}
          </p>
        </div>

        <div style="display: flex; gap: 0.6rem;">
          <button class="btn btn-secondary" id="btn-export-csv">
            ${icon('download', 16)}
            <span>CSV (Excel) 다운로드</span>
          </button>
          <button class="btn btn-primary" id="btn-print-report">
            ${icon('printer', 16)}
            <span>공식 임상 기록지 인쇄</span>
          </button>
        </div>
      </div>

      <!-- 종단 추세 분석 차트 (Chart.js) -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="icon-chip">${icon('chart', 18)}</span>
            <h3 style="font-size: 1.15rem;">종단 수행 추세 (회기별 정반응률 & 인출 속도)</h3>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            기준선(80%): STG 치료 목표치
          </span>
        </div>

        <div style="height: 280px; width: 100%;">
          <canvas id="clinical-trend-chart"></canvas>
        </div>
      </div>

      <!-- 최신 세션 상세 분석: 단서 수준 분포 & 오류 유형 분석 -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem;">
        
        <!-- 단서 위계 의존도 분포 -->
        <div class="card">
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;">
            <span class="icon-chip">${icon('bulb', 18)}</span>
            <h3 style="font-size: 1.1rem;">단서 위계(Cue) 의존도 분석</h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${CUE_HIERARCHY.map((c, i) => {
              const count = latestSession.cueDistribution ? latestSession.cueDistribution[i] || 0 : (i === 0 ? latestSession.correctCount : 0);
              const pct = Math.round((count / Math.max(1, latestSession.totalTasks)) * 100);
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem;">
                    <span>${c.label} (${c.score}점)</span>
                    <span style="color: var(--text-muted);">${count}문항 (${pct}%)</span>
                  </div>
                  <div style="width: 100%; height: 6px; background: var(--bg-subtle); border-radius: 9999px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: var(--brand-primary); border-radius: 9999px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 오류 유형(Error Taxonomy) 분석 -->
        <div class="card">
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;">
            <span class="icon-chip">${icon('alert', 18)}</span>
            <h3 style="font-size: 1.1rem;">주요 발화 오류 유형 분석</h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${Object.entries(ERROR_TYPES).filter(([k]) => k !== 'NONE').map(([key, info]) => {
              const count = latestSession.errorDistribution ? (latestSession.errorDistribution[key] || 0) : 0;
              const pct = Math.round((count / Math.max(1, latestSession.totalTasks)) * 100);
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem;">
                    <span style="color: ${info.color};">${info.label}</span>
                    <span style="color: var(--text-muted);">${count}회 (${pct}%)</span>
                  </div>
                  <div style="width: 100%; height: 6px; background: var(--bg-subtle); border-radius: 9999px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: ${info.color}; border-radius: 9999px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>

      <!-- SOAP 임상 기록 실시간 확인 및 편집 카드 -->
      <div class="card" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="icon-chip">${icon('file', 18)}</span>
            <div>
              <h3 style="font-size: 1.15rem;">SOAP 임상 기록지 (치료사 검토 및 수정)</h3>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                회기일: ${latestSession.date} · 영역: ${domainName(latestSession.domain)} (${levelName(latestSession.difficulty)})
              </div>
            </div>
          </div>

          <button class="btn btn-secondary" id="btn-save-soap" style="padding: 0.4rem 0.9rem; font-size: 0.85rem;">
            ${icon('save', 14)} SOAP 저장
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="font-size: 0.9rem; font-weight: 800; color: var(--brand-primary); display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem;">
              <span>S</span> (Subjective - 주관적 상태 및 라포)
            </label>
            <textarea id="soap-input-s" rows="2" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 0.95rem; line-height: 1.5;">${esc(latestSession.soap?.s || '')}</textarea>
          </div>

          <div>
            <label style="font-size: 0.9rem; font-weight: 800; color: var(--brand-primary); display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem;">
              <span>O</span> (Objective - 객관적 정량 지표)
            </label>
            <textarea id="soap-input-o" rows="2" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 0.95rem; line-height: 1.5;">${esc(latestSession.soap?.o || '')}</textarea>
          </div>

          <div>
            <label style="font-size: 0.9rem; font-weight: 800; color: var(--brand-primary); display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem;">
              <span>A</span> (Assessment - 임상적 평가 및 원인 분석)
            </label>
            <textarea id="soap-input-a" rows="3" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 0.95rem; line-height: 1.5;">${esc(latestSession.soap?.a || '')}</textarea>
          </div>

          <div>
            <label style="font-size: 0.9rem; font-weight: 800; color: var(--brand-primary); display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem;">
              <span>P</span> (Plan - 차기 회기 계획 및 난이도 처방)
            </label>
            <textarea id="soap-input-p" rows="2" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 0.95rem; line-height: 1.5;">${esc(latestSession.soap?.p || '')}</textarea>
          </div>
        </div>
      </div>

    </div>
  `;

  // 1. Chart.js 종단 추세선 렌더링
  initTrendChart(container, sessions);

  // 2. 이벤트 바인딩
  container.querySelector('#btn-export-csv').onclick = () => {
    const csvData = reportAgent.exportToCSV(sessions, patient);
    downloadFile(csvData, `${patient.name}_임상세션기록_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
    toast('CSV 파일이 다운로드되었습니다.', 'success');
  };

  container.querySelector('#btn-print-report').onclick = () => {
    reportAgent.printSession(latestSession, patient);
  };

  container.querySelector('#btn-save-soap').onclick = () => {
    const updatedSoap = {
      s: container.querySelector('#soap-input-s').value.trim(),
      o: container.querySelector('#soap-input-o').value.trim(),
      a: container.querySelector('#soap-input-a').value.trim(),
      p: container.querySelector('#soap-input-p').value.trim()
    };

    store.updateSessionSoap(latestSession.id, updatedSoap);
    toast('SOAP 임상 기록이 성공적으로 저장되었습니다.', 'success');
  };
}

function initTrendChart(container, sessions) {
  const canvas = container.querySelector('#clinical-trend-chart');
  if (!canvas || !window.Chart) return;

  const labels = sessions.map((s, i) => `${i + 1}회기 (${s.date.slice(5)})`);
  const accuracyData = sessions.map(s => s.accuracy);
  const latencyData = sessions.map(s => sec(s.avgLatencyMs || 0));

  new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '정반응률 (%)',
          data: accuracyData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: '반응 속도 (초)',
          data: latencyData,
          borderColor: '#0B6E99',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 100,
          title: { display: true, text: '정반응률 (%)' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 8,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '반응 잠복기 (초)' }
        }
      }
    }
  });
}
