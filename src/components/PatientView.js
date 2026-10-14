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
import { esc, sec, levelName } from '../utils/helpers.js';

// 뷰 재진입 시 이전 구독 해제를 위한 모듈 단위 핸들
let activeUnsubscribe = null;

export function renderPatientView(container, sessionConfig, onFinishToReport) {
  const orch = sessionOrchestrator;

  // 이전 진입에서 남은 구독 해제 (중복 렌더·중복 TTS 방지)
  if (activeUnsubscribe) activeUnsubscribe();
  speechAgent.stopListening();
  speechAgent.cancelSpeech();

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
                  난이도: ${levelName(currentLevel)}
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
            ${task.domain === 'auditory' ? `
              <div id="auditory-hidden-note" style="font-size: 1.15rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.6rem;">
                🎧 잘 듣고 답해 주세요. (청각 이해 과제는 글자가 가려져 있습니다)
              </div>` : ''}
            <h2 class="stimulus-prompt-text" id="prompt-text" style="${task.domain === 'auditory' ? 'display:none;' : ''}">
              ${esc(task.question).replace(/\n/g, '<br>')}
            </h2>
            <button class="btn btn-secondary" id="btn-read-prompt" style="padding: 0.5rem 1.1rem; font-size: 0.9rem; margin-top: 0.3rem;">
              ${icon('volume', 18)}
              <span>문제 다시 듣기</span>
            </button>
            ${task.domain === 'auditory' ? `
              <button class="btn btn-ghost" id="btn-reveal-text" style="padding: 0.5rem 1.1rem; font-size: 0.9rem; margin-top: 0.3rem;">
                ${icon('type', 18)}<span>글자로 보기</span>
              </button>` : ''}
          </div>

          <!-- [치료사 / 특수교사용] 태블릿 원클릭 신속 판정 패널 -->
          <div class="clinician-touch-eval-card" style="width: 100%; max-width: 680px; background: var(--bg-subtle); border: 1.5px solid var(--border-medium); border-radius: var(--radius-lg); padding: 1rem 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; color: var(--text-primary); font-size: 0.95rem;">
                <span class="icon-chip" style="width:24px;height:24px;font-size:0.8rem;">👩‍⚕️</span>
                <span>치료사·교사 원클릭 판정 (터치 즉시 채점)</span>
              </div>
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--brand-primary); background: var(--brand-primary-light); padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">
                현재 단서: <span id="lbl-active-cue-name">${CUE_HIERARCHY[cueLevel]?.label || '자발 산출'}</span> (<span id="lbl-active-cue-score">${CUE_HIERARCHY[cueLevel]?.score || 100}</span>점)
              </div>
            </div>

            <div class="touch-eval-btn-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem;">
              <button class="btn-touch-eval touch-correct" id="btn-touch-spontaneous" type="button" title="힌트 없이 스스로 성공">
                <span style="font-size: 1.25rem;">🟢</span>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                  <strong style="font-size: 0.92rem;">정답 (자발)</strong>
                  <span style="font-size: 0.75rem; opacity: 0.85;">100점 · 무단서</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-cued" id="btn-touch-cued" type="button" title="단서 확인 후 정답 발화">
                <span style="font-size: 1.25rem;">💡</span>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                  <strong style="font-size: 0.92rem;">단서 후 정답</strong>
                  <span style="font-size: 0.75rem; opacity: 0.85;" id="lbl-touch-cued-pts">${cueLevel > 0 ? `${CUE_HIERARCHY[cueLevel]?.score}점 · ${CUE_HIERARCHY[cueLevel]?.short}` : '85점 · 1단계'}</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-partial" id="btn-touch-partial" type="button" title="근접 발음 또는 핵심어 산출">
                <span style="font-size: 1.25rem;">🔵</span>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                  <strong style="font-size: 0.92rem;">부분 산출</strong>
                  <span style="font-size: 0.75rem; opacity: 0.85;">70% 인정</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-incorrect" id="btn-touch-incorrect" type="button" title="오답 또는 무반응">
                <span style="font-size: 1.25rem;">🔴</span>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                  <strong style="font-size: 0.92rem;">오답 / 무반응</strong>
                  <span style="font-size: 0.75rem; opacity: 0.85;">0점</span>
                </div>
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
              <span>다음 단계 단서(힌트) 제시하기 (현재 ${cueLevel}단계: ${CUE_HIERARCHY[cueLevel]?.short || '자발'})</span>
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

          <!-- 보조: 마이크 음성 인식 및 직접 텍스트 입력 영역 -->
          <div class="mic-action-area" style="border-top: 1px dashed var(--border-light); padding-top: 1.2rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: -0.3rem;">
              보조 음성인식 (환자 자율 발화용)
            </div>

            <canvas id="audio-wave-canvas" class="audio-visualizer-canvas" width="240" height="36"></canvas>

            <button class="mic-btn-circle" id="btn-mic-toggle" title="마이크 누르고 말씀하세요" aria-label="마이크 음성 입력" style="width: 72px; height: 72px;">
              ${icon('mic', 32, 2.5)}
            </button>

            <div id="mic-status-label" style="font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); min-height: 1.4rem;">
              마이크 버튼을 누르고 말씀하시거나, 위 빠른 채점 버튼을 누르세요 🎙️
            </div>

            <!-- 직접 텍스트 입력 보조창 -->
            <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 440px;">
              <input type="text" id="input-response-text" placeholder="음성인식 결과 또는 텍스트 입력" style="flex: 1; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-medium); font-size: 1rem; text-align: center; color: var(--text-primary); font-weight: 600;">
              <button class="btn btn-secondary" id="btn-submit-text" style="padding: 0.65rem 1.1rem; font-size: 0.95rem;">
                입력 제출
              </button>
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

    // 0. 치료사/특수교사 원터치 신속 판정 버튼 바인딩
    const btnSpontaneous = container.querySelector('#btn-touch-spontaneous');
    const btnCued = container.querySelector('#btn-touch-cued');
    const btnPartial = container.querySelector('#btn-touch-partial');
    const btnIncorrect = container.querySelector('#btn-touch-incorrect');

    if (btnSpontaneous) {
      btnSpontaneous.onclick = () => {
        orch.submitAnswer(task.targetWord, 'clinician_spontaneous');
      };
    }
    if (btnCued) {
      btnCued.onclick = () => {
        if (orch.currentCueLevel === 0) {
          orch.currentCueLevel = 1;
        }
        orch.submitAnswer(task.targetWord, 'clinician_cued');
      };
    }
    if (btnPartial) {
      btnPartial.onclick = () => {
        orch.submitAnswer(task.targetWord, 'clinician_partial');
      };
    }
    if (btnIncorrect) {
      btnIncorrect.onclick = () => {
        orch.submitAnswer('', 'clinician_incorrect');
      };
    }

    // 1. 문제 다시 읽기
    btnReadPrompt.onclick = () => {
      speechAgent.speak(task, orch.config.speechRate);
    };

    const btnReveal = container.querySelector('#btn-reveal-text');
    if (btnReveal) {
      btnReveal.onclick = () => {
        container.querySelector('#prompt-text').style.display = '';
        container.querySelector('#auditory-hidden-note')?.remove();
        btnReveal.remove();
      };
    }

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
              const clean = (transcript || '').trim();
              const alts = Array.isArray(alternatives) ? alternatives.map(a => (a || '').trim()).filter(Boolean) : [];
              const orderedAlts = [clean, ...alts.filter(a => a !== clean)];
              orch.submitAnswer(orderedAlts.length ? orderedAlts : clean, 'speech');
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
        // 단서 상태 라벨 갱신
        const lblActiveCue = container.querySelector('#lbl-active-cue-name');
        const lblActiveScore = container.querySelector('#lbl-active-cue-score');
        const lblTouchPts = container.querySelector('#lbl-touch-cued-pts');
        if (lblActiveCue) lblActiveCue.textContent = cue.label;
        if (lblActiveScore) lblActiveScore.textContent = cue.score;
        if (lblTouchPts) lblTouchPts.textContent = `${cue.score}점 · ${cue.short}`;

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
        <div style="flex: 1;">
          <div style="font-size: 1.25rem; font-weight: 800;">${esc(evaluation.feedbackTitle)}</div>
          <div style="font-size: 0.95rem; margin-top: 0.2rem; opacity: 0.95;">${esc(evaluation.feedbackMsg)}</div>
          <div style="font-size: 0.82rem; margin-top: 0.35rem; display: flex; gap: 0.8rem; flex-wrap: wrap; font-weight: 600;">
            <span>인식 발화: <strong style="color:var(--text-primary);">"${esc(evaluation.userResponse || '무응답')}"</strong></span>
            <span>단서 점수: <strong>${evaluation.score}점</strong></span>
            <span>반응 잠복기: ${sec(evaluation.latencyMs)}초</span>
            ${evaluation.ambiguousStt ? `<span style="color: #D97706; background: #FEF3C7; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">⚠️ STT 모호 (하단 버튼으로 즉시 정정 가능)</span>` : ''}
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
    speechAgent.speak(`${evaluation.feedbackTitle}. ${evaluation.feedbackMsg}`, orch.config.speechRate);

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
      activeUnsubscribe = null;
      onFinishToReport();
    };
  }

  // 오케스트레이터 이벤트 리스너 연결 (반드시 세션 시작 전에 구독)
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
  activeUnsubscribe = unsubscribe;

  // 세션 시작 (구독 이후 호출해야 첫 문항이 렌더링됨)
  orch.startSession(null, sessionConfig || {});
}
