// ==========================================================================
//  대상자(환자) 재활 훈련 화면 컴포넌트 (PatientView.js)
//  - SessionOrchestrator와 완전 연동
//  - 최소->최대 단서 위계(Cueing Hierarchy) 6단계 단계별 버튼 및 점수 시스템
//  - 대형 시각 자극 및 반응형 레이아웃
//  - Web Speech API 음성인식 + 실시간 파형 + 즉각 임상 피드백
// ==========================================================================

import { sessionOrchestrator } from '../agents/sessionOrchestrator.js';
import { speechAgent } from '../agents/speechAgent.js';
import { cueAgent, CUE_HIERARCHY } from '../agents/cueAgent.js';
import { icon } from '../utils/icons.js';
import { esc, sec } from '../utils/helpers.js';

export function renderPatientView(container, sessionConfig, onFinishToReport) {
  const orch = sessionOrchestrator;
  
  // 세션 시작
  orch.startSession(null, sessionConfig || {});

  // 오케스트레이터 구독 해제 함수 보관
  let unsubscribe = null;

  function renderTaskScreen(data) {
    const { index, total, task, currentLevel, cueLevel, options } = data;
    const progressPct = Math.round(((index) / total) * 100);

    container.innerHTML = `
      <div class="training-container">
        <div class="patient-training-card">
          
          <!-- 상단 진행률 & 난이도 뱃지 -->
          <div style="width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="background: var(--brand-primary-light); color: var(--brand-primary); padding: 0.3rem 0.8rem; border-radius: var(--radius-full); font-weight: 800; font-size: 0.95rem;">
                  문제 ${index + 1} / ${total}
                </span>
                <span style="background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-light); padding: 0.25rem 0.7rem; border-radius: var(--radius-full); font-size: 0.85rem; font-weight: 600;">
                  난이도: ${currentLevel}
                </span>
              </div>
              <span style="font-weight: 800; color: var(--brand-primary); font-size: 1rem;">
                ${progressPct}% 완료
              </span>
            </div>
            
            <div class="training-progress-bar">
              <div class="training-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          </div>

          <!-- 중앙 대형 시각 자극 (Visual Stimulus) -->
          <div class="stimulus-visual-box">
            <span>${task.visualPrompt || '🗣️'}</span>
          </div>

          <!-- 문제 안내 텍스트 및 발음 듣기 버튼 -->
          <div style="max-width: 680px; width: 100%;">
            <h2 class="stimulus-prompt-text">
              ${task.question.replace(/\n/g, '<br>')}
            </h2>
            <button class="btn btn-secondary" id="btn-read-prompt" style="padding: 0.5rem 1.1rem; font-size: 0.9rem; margin-top: 0.3rem;">
              ${icon('volume', 18)}
              <span>문제 다시 듣기</span>
            </button>
          </div>

          <!-- 마이크 음성 인식 및 음파 시각화 액션 영역 -->
          <div class="mic-action-area">
            <canvas id="audio-wave-canvas" class="audio-visualizer-canvas" width="240" height="40"></canvas>

            <button class="mic-btn-circle" id="btn-mic-toggle" title="마이크 누르고 말씀하세요" aria-label="마이크 음성 입력">
              ${icon('mic', 38, 2.5)}
            </button>

            <div id="mic-status-label" style="font-size: 1.05rem; font-weight: 700; color: var(--text-secondary); min-height: 1.6rem;">
              마이크 버튼을 누르고 말씀해 보세요 🎙️
            </div>

            <!-- 직접 텍스트 입력 보조창 (터치 키보드 환경 지원) -->
            <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 440px;">
              <input type="text" id="input-response-text" placeholder="음성인식 결과 또는 직접 입력" style="flex: 1; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 2px solid var(--border-medium); font-size: 1.1rem; text-align: center; color: var(--text-primary); font-weight: 600;">
              <button class="btn btn-primary" id="btn-submit-text" style="padding: 0.75rem 1.4rem;">
                제출
              </button>
            </div>
          </div>

          <!-- 단서 위계(Cueing Hierarchy) 제어 영역 -->
          <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.8rem;">
            <div class="cue-hierarchy-strip">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-right: 0.3rem;">단서 위계:</span>
              ${CUE_HIERARCHY.map(c => `
                <span class="cue-step-chip ${cueLevel === c.level ? 'active' : ''}">
                  ${c.short}
                </span>
              `).join('')}
            </div>

            <!-- 단서 요청 버튼 -->
            <button class="btn btn-secondary" id="btn-request-cue" style="padding: 0.6rem 1.2rem; border-color: var(--brand-warning); color: var(--brand-warning); background: var(--brand-warning-light); font-weight: 700;">
              ${icon('bulb', 18)}
              <span>단서(힌트) 요청하기 (현재 ${cueLevel}단계)</span>
            </button>

            <!-- 단서 안내 박스 (요청 시 표시) -->
            <div id="cue-display-box" style="display: none; width: 100%; max-width: 540px; padding: 1rem 1.25rem; border-radius: var(--radius-md); background: var(--brand-warning-light); border: 1.5px solid var(--brand-warning-border); color: #92400E; font-weight: 700; font-size: 1.1rem;">
            </div>

            <!-- 보기 선택 버튼군 (단서 5단계 이상 또는 보기 선택 모드 시 표시) -->
            <div id="choice-options-container" class="option-btn-grid" style="display: ${cueLevel >= 5 ? 'grid' : 'none'}; margin-top: 0.5rem;">
              ${options.map(opt => `
                <button class="option-select-btn" data-val="${esc(opt)}">
                  ${esc(opt)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 수행 평가 피드백 배너 영역 -->
          <div id="evaluation-banner-container" style="width: 100%;"></div>

        </div>
      </div>
    `;

    bindScreenEvents(container, task);
  }

  function bindScreenEvents(container, task) {
    const canvas = container.querySelector('#audio-wave-canvas');
    const btnMic = container.querySelector('#btn-mic-toggle');
    const statusLabel = container.querySelector('#mic-status-label');
    const inputText = container.querySelector('#input-response-text');
    const btnSubmit = container.querySelector('#btn-submit-text');
    const btnReadPrompt = container.querySelector('#btn-read-prompt');
    const btnCue = container.querySelector('#btn-request-cue');
    const cueBox = container.querySelector('#cue-display-box');
    const choiceBox = container.querySelector('#choice-options-container');

    // 1. 문제 다시 읽기
    btnReadPrompt.onclick = () => {
      speechAgent.speak(task.question);
    };

    // 2. 마이크 토글 (STT)
    btnMic.onclick = () => {
      if (speechAgent.isRecording) {
        speechAgent.stopListening();
      } else {
        speechAgent.startListening({
          canvas,
          onResult: (transcript, isFinal, alternatives) => {
            inputText.value = transcript;
            statusLabel.innerHTML = `인식 중: <strong style="color:var(--brand-primary);">"${esc(transcript)}"</strong>`;

            if (isFinal) {
              orch.submitAnswer(alternatives && alternatives.length ? alternatives : transcript, 'speech');
            }
          },
          onError: (err, msg) => {
            statusLabel.textContent = msg;
          },
          onState: (recording) => {
            if (recording) {
              btnMic.classList.add('recording');
              statusLabel.textContent = '듣고 있습니다... 또박또박 말씀해 주세요 🎙️';
            } else {
              btnMic.classList.remove('recording');
            }
          }
        });
      }
    };

    // 3. 텍스트 직접 제출
    btnSubmit.onclick = () => {
      const val = inputText.value.trim();
      if (val) {
        orch.submitAnswer(val, 'text');
      } else {
        statusLabel.textContent = '답안을 말씀하시거나 입력창에 적어주세요.';
      }
    };

    inputText.onkeydown = (e) => {
      if (e.key === 'Enter') btnSubmit.click();
    };

    // 4. 단서 요청
    btnCue.onclick = () => {
      const cue = orch.requestNextCue();
      if (cue) {
        cueBox.style.display = 'block';
        cueBox.innerHTML = `
          <div style="font-size: 0.85rem; color: #B45309; margin-bottom: 0.2rem;">[${cue.label}]</div>
          <div style="${cue.big ? 'font-size: 1.6rem; letter-spacing: 0.1em; color: var(--text-primary);' : ''}">${esc(cue.text)}</div>
        `;
        if (orch.currentCueLevel >= 5) {
          choiceBox.style.display = 'grid';
        }
      } else {
        btnCue.disabled = true;
        btnCue.textContent = '최대 단서 제공 완료';
      }
    };

    // 5. 보기 버튼 클릭
    choiceBox.querySelectorAll('.option-select-btn').forEach(btn => {
      btn.onclick = () => {
        const val = btn.getAttribute('data-val');
        inputText.value = val;
        orch.submitAnswer(val, 'choice');
      };
    });
  }

  // 평가 완료 피드백 화면 표시
  function showFeedback(data) {
    const { evaluation, adaptResult, isLast } = data;
    const bannerBox = container.querySelector('#evaluation-banner-container');
    if (!bannerBox) return;

    const bannerClass = evaluation.status === 'CORRECT' ? 'correct' : (evaluation.status === 'PARTIAL' ? 'partial' : 'incorrect');

    bannerBox.innerHTML = `
      <div class="feedback-banner ${bannerClass}">
        <div>
          <div style="font-size: 1.25rem; font-weight: 800;">${esc(evaluation.feedbackTitle)}</div>
          <div style="font-size: 0.95rem; margin-top: 0.2rem; opacity: 0.95;">${esc(evaluation.feedbackMsg)}</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem; display: flex; gap: 0.8rem; font-weight: 600;">
            <span>단서 점수: ${evaluation.score}점</span>
            <span>반응 잠복기: ${sec(evaluation.latencyMs)}초</span>
            ${adaptResult.action !== 'HOLD' ? `<span style="color: var(--brand-purple); font-weight: 800;">${adaptResult.reason}</span>` : ''}
          </div>
        </div>

        <button class="btn btn-primary btn-large" id="btn-next-step" style="white-space: nowrap;">
          ${isLast ? '훈련 완료 (결과 보기) 🎉' : '다음 문제로 →'}
        </button>
      </div>
    `;

    // 팡파레 효과 (정답 시)
    if (evaluation.isCorrect && window.confetti) {
      window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 } });
    }

    // TTS 피드백 음성 안내
    speechAgent.speak(`${evaluation.feedbackTitle}. ${evaluation.feedbackMsg}`);

    bannerBox.querySelector('#btn-next-step').onclick = () => {
      if (isLast) {
        orch.finishSession();
      } else {
        orch.nextTask();
      }
    };
  }

  // 세션 종료 결과 요약 화면
  function showSummary(data) {
    const { report } = data;

    container.innerHTML = `
      <div class="training-container">
        <div class="patient-training-card" style="gap: 2rem;">
          <div>
            <div style="font-size: 4rem; margin-bottom: 0.5rem;">🎉</div>
            <h2 style="font-size: 2.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
              오늘의 재활 훈련을 완수하셨습니다!
            </h2>
            <p style="font-size: 1.1rem; color: var(--text-secondary);">
              총 ${report.totalTasks}문항 중 <strong style="color: var(--brand-success); font-size: 1.4rem;">${report.correctCount}</strong>문항을 정반응으로 완료하셨습니다.
            </p>
          </div>

          <!-- 주요 성취 지표 -->
          <div style="display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; width: 100%;">
            <div style="background: var(--bg-subtle); padding: 1.25rem 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-light); min-width: 160px;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">정반응률</div>
              <div style="font-size: 2.4rem; font-weight: 800; color: var(--brand-success); font-family: 'Outfit', sans-serif;">
                ${report.accuracy}%
              </div>
            </div>

            <div style="background: var(--bg-subtle); padding: 1.25rem 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-light); min-width: 160px;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">자발 산출률 (무단서)</div>
              <div style="font-size: 2.4rem; font-weight: 800; color: var(--brand-primary); font-family: 'Outfit', sans-serif;">
                ${report.independentRate}%
              </div>
            </div>

            <div style="background: var(--bg-subtle); padding: 1.25rem 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-light); min-width: 160px;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">평균 반응 속도</div>
              <div style="font-size: 2.4rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif;">
                ${sec(report.avgLatencyMs)}초
              </div>
            </div>
          </div>

          <!-- 하단 액션 버튼 -->
          <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
            <button class="btn btn-secondary btn-large" id="btn-restart-session">
              ${icon('refresh', 18)} 다시 연습하기
            </button>
            <button class="btn btn-primary btn-large" id="btn-view-report">
              ${icon('chart', 18)} 임상 리포트 확인하기
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.confetti) {
      window.confetti({ particleCount: 100, spread: 90 });
    }

    container.querySelector('#btn-restart-session').onclick = () => {
      orch.startSession(null, sessionConfig);
    };

    container.querySelector('#btn-view-report').onclick = () => {
      if (unsubscribe) unsubscribe();
      onFinishToReport();
    };
  }

  // 오케스트레이터 이벤트 리스너 연결
  unsubscribe = orch.subscribe((event, data) => {
    switch (event) {
      case 'TASK_LOADED':
        renderTaskScreen(data);
        break;
      case 'EVALUATION_COMPLETED':
        showFeedback(data);
        break;
      case 'SESSION_FINISHED':
        showSummary(data);
        break;
    }
  });
}
