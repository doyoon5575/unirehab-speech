// ==========================================================================
//  대상자(환자) 재활 훈련 화면 컴포넌트 (PatientView.js)
//  - 말잇다(malitda.junghaebom.com) 감성 극상의 클린 미학 & 실시간 음절 채우기 (Syllable Fill)
//  - SessionOrchestrator 및 6단계 단서 위계(Cueing Hierarchy)와 완전 연동
//  - 대형 타이포그래피, 은은한 라디얼 배경, 세션 미니 막대 그래프
//  - 실시간 Web Speech STT 연동 글자 차오름 애니메이션 + 치료사 원터치 즉시 판정
// ==========================================================================

import { sessionOrchestrator } from '../agents/sessionOrchestrator.js';
import { speechAgent } from '../agents/speechAgent.js';
import { cueAgent, CUE_HIERARCHY } from '../agents/cueAgent.js';
import { icon } from '../utils/icons.js';
import { esc, sec, levelName } from '../utils/helpers.js';

// 뷰 재진입 시 이전 구독 해제를 위한 모듈 단위 핸들
let activeUnsubscribe = null;

// 말잇다 스타일: 텍스트를 단어와 음절(syllable-fill) 단위로 변환하는 헬퍼
function buildSyllableMarkup(text) {
  if (!text) return '';
  const clean = text.trim();
  const words = clean.split(/\s+/);

  return words.map(word => {
    const chars = Array.from(word).map(ch => {
      // 한글 또는 알파벳/숫자인 경우 음절 채우기 타겟
      if (/[\uAC00-\uD7AFa-zA-Z0-9]/.test(ch)) {
        return `<span class="syllable-fill" data-char="${esc(ch)}" style="--fill: 0%;">${esc(ch)}</span>`;
      }
      return `<span class="syllable-punct">${esc(ch)}</span>`;
    }).join('');

    return `<span class="syllable-word">${chars}</span>`;
  }).join(' ');
}

// 음성 인식 텍스트와 타겟 문장의 일치도를 음절 단위로 계산하여 --fill 스타일 반영
function updateSyllableFills(container, spokenText, targetText) {
  if (!container) return;
  const syllableEls = container.querySelectorAll('.stimulus-prompt-text .syllable-fill');
  if (!syllableEls || syllableEls.length === 0) return;

  const spoken = (spokenText || '').replace(/\s+/g, '');
  const targetChars = Array.from((targetText || '').replace(/\s+/g, ''));

  if (!spoken) {
    syllableEls.forEach(el => {
      el.style.setProperty('--fill', '0%');
      el.classList.remove('speaking');
    });
    return;
  }

  let spokenIdx = 0;
  syllableEls.forEach(el => {
    const char = el.getAttribute('data-char');
    if (!char) return;

    // 말한 문장 안에 해당 음절이 포함되어 있는지 확인
    const foundIdx = spoken.indexOf(char, spokenIdx);
    if (foundIdx !== -1) {
      el.style.setProperty('--fill', '100%');
      el.classList.add('speaking');
      spokenIdx = foundIdx + 1;
    } else {
      // 부분 유사도 체크 (초성 일치 등 가벼운 매칭 시 40% 채움)
      const hasSimilar = spoken.length > 0 && spoken.split('').some(s => s === char);
      if (hasSimilar) {
        el.style.setProperty('--fill', '45%');
      } else {
        el.style.setProperty('--fill', '0%');
      }
      el.classList.remove('speaking');
    }
  });
}

// 전체 음절을 100% 채우는 피드백 애니메이션
function fillAllSyllables(container, percent = 100) {
  if (!container) return;
  const syllableEls = container.querySelectorAll('.stimulus-prompt-text .syllable-fill');
  syllableEls.forEach((el, i) => {
    setTimeout(() => {
      el.style.setProperty('--fill', `${percent}%`);
      if (percent >= 100) el.classList.add('speaking');
    }, i * 35);
  });
}

export function renderPatientView(container, sessionConfig, onFinishToReport) {
  const orch = sessionOrchestrator;

  // 이전 진입에서 남은 구독 해제 (중복 렌더·중복 TTS 방지)
  if (activeUnsubscribe) activeUnsubscribe();
  speechAgent.stopListening();
  speechAgent.cancelSpeech();

  let unsubscribe = null;

  function renderTaskScreen(data) {
    const { index, total, task, currentLevel, cueLevel, options } = data;
    const progressPct = Math.round(((index + 1) / total) * 100);

    // 도메인 한글 레이블
    const domainLabels = {
      naming: '이름대기',
      auditory: '청각 이해',
      repetition: '따라말하기',
      reading: '문장 읽기',
      syntax: '문법 및 구문',
      pragmatics: '화용 및 대화',
      apraxia: '조음 및 발음'
    };
    const domainTitle = domainLabels[task.domain] || '발음 및 언어재활';

    // 10문항(세션) 막대 그래프 생성 (말잇다 스코어 스토리 스타일)
    const barItemsHtml = Array.from({ length: total }, (_, i) => {
      let heightPct = 0;
      if (i < index) heightPct = 100;
      else if (i === index) heightPct = 35; // 현재 진행 중
      return `
        <div class="session-bar-track-item" title="문항 ${i + 1}">
          <div class="session-bar-track">
            <span class="session-bar-fill" style="height: ${heightPct}%; ${i === index ? 'opacity: 0.8;' : ''}"></span>
          </div>
          <span class="session-bar-num" style="${i === index ? 'color: var(--color-accent); font-weight: 800;' : ''}">${i + 1}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="training-container">
        <div class="patient-training-card">
          
          <!-- 상단: 말잇다 스타일 훈련 뱃지 & 10문항 세션 트래커 바 -->
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="rehab-pill-badge">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent);"></span>
                ${domainTitle} 훈련
              </span>
              <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">
                ${levelName(currentLevel)}
              </span>
            </div>

            <!-- 세션 미니 인디케이터 바 (1~10문항) -->
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="session-bar-track-group" style="width: ${Math.min(total * 16, 220)}px;">
                ${barItemsHtml}
              </div>
              <span style="font-weight: 700; color: var(--color-accent); font-size: 0.88rem; font-variant-numeric: tabular-nums;">
                ${index + 1} / ${total}
              </span>
            </div>
          </div>

          <!-- 중앙 시각 자극 (Visual Stimulus) - 순백의 단정한 카드 프레임 -->
          <div class="stimulus-visual-box">
            <span>${task.visualPrompt || '🗣️'}</span>
          </div>

          <!-- 문제 안내 텍스트: 말잇다 스타일 대형 음절 단위 채우기 (Syllable Fill) -->
          <div style="width: 100%; max-width: 720px;">
            ${task.domain === 'auditory' ? `
              <div id="auditory-hidden-note" style="font-size: 1.1rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.8rem;">
                🎧 소리를 잘 듣고 답해 주세요. (청각 이해 과제)
              </div>` : ''}

            <h2 class="stimulus-prompt-text" id="prompt-text" style="${task.domain === 'auditory' ? 'display:none;' : ''}">
              ${buildSyllableMarkup(task.question)}
            </h2>

            <!-- 말잇다 시그니처: 음절 채움 안내 레전드 칩 -->
            <div class="syllable-legend-list" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.75rem 1rem; margin: 1.25rem 0 0.4rem 0;">
              <span class="syllable-legend-chip chip-rise" style="display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 9999px; border: 1px solid var(--border-hairline); background: rgba(255, 255, 255, 0.98); padding: 0.45rem 1.15rem 0.45rem 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); font-size: 0.88rem; font-weight: 600; color: var(--text-secondary);">
                <span class="syllable-fill" style="--fill:100%; font-size:1.15rem; padding:0 2px; font-weight: 800; color: var(--color-accent); -webkit-text-fill-color: var(--color-accent);">날</span>
                <span>또렷하게 읽은 만큼 색이 찹니다</span>
              </span>
              <span class="syllable-legend-chip chip-rise" style="animation-delay: 0.12s; display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 9999px; border: 1px solid var(--border-hairline); background: rgba(255, 255, 255, 0.98); padding: 0.45rem 1.15rem 0.45rem 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); font-size: 0.88rem; font-weight: 600; color: var(--text-secondary);">
                <span class="syllable-fill" style="--fill:45%; font-size:1.15rem; padding:0 2px; font-weight: 800; color: #828c96;">씨</span>
                <span>다시 읽어볼 부분</span>
              </span>
            </div>

            <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.8rem;">
              <button class="btn btn-ghost" id="btn-read-prompt" style="font-size: 0.88rem; padding: 0.4rem 1rem; color: var(--text-secondary);">
                ${icon('volume', 16)} <span>문제 다시 듣기</span>
              </button>
              ${task.domain === 'auditory' ? `
                <button class="btn btn-ghost" id="btn-reveal-text" style="font-size: 0.88rem; padding: 0.4rem 1rem; color: var(--text-secondary);">
                  ${icon('type', 16)} <span>글자로 보기</span>
                </button>` : ''}
            </div>
          </div>

          <!-- 자율 발화 마이크 입력 영역 - 말잇다 감성의 우아한 대형 버튼 -->
          <div class="mic-action-area" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
            <canvas id="audio-wave-canvas" class="audio-visualizer-canvas" width="220" height="30"></canvas>

            <button class="btn mic-btn-circle" id="btn-mic-toggle" title="마이크를 누르고 말씀해 주세요" aria-label="마이크 음성 입력" style="width: 84px; height: 84px; border-radius: 9999px; background: var(--color-accent); color: white; border: none; box-shadow: var(--shadow-glow); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: transform 0.16s ease;">
              ${icon('mic', 34, 2.4)}
            </button>

            <div id="mic-status-label" style="font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); min-height: 1.4rem;">
              마이크를 누르고 소리 내어 읽어주세요
            </div>

            <!-- 직접 텍스트 입력 보조 (필요 시) -->
            <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 420px; margin-top: 0.2rem;">
              <input type="text" id="input-response-text" placeholder="음성 결과 또는 직접 입력" style="flex: 1; padding: 0.6rem 1rem; border-radius: var(--radius-pill); border: 1px solid var(--border-hairline); background: #FFFFFF; font-size: 0.92rem; text-align: center; color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <button class="btn btn-secondary" id="btn-submit-text" style="padding: 0.6rem 1.2rem; font-size: 0.88rem; border-radius: var(--radius-pill);">
                입력
              </button>
            </div>
          </div>

          <!-- 단서 위계(Cue) 영역 - 조용하고 정갈한 알약 칩 -->
          <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 0.2rem;">
            <div class="cue-hierarchy-strip">
              <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; margin-right: 0.2rem;">단계별 단서:</span>
              ${CUE_HIERARCHY.map(c => `
                <span class="cue-step-chip ${cueLevel === c.level ? 'active' : ''}">
                  ${c.short}
                </span>
              `).join('')}
            </div>

            <!-- 단서 요청 버튼 -->
            <button class="btn btn-secondary" id="btn-request-cue" style="padding: 0.45rem 1.2rem; font-size: 0.88rem; color: var(--brand-warning); border-color: var(--brand-warning-border); background: var(--brand-warning-light); border-radius: var(--radius-pill);">
              ${icon('bulb', 16)}
              <span>단서(힌트) 제시 (${cueLevel}단계: ${CUE_HIERARCHY[cueLevel]?.short || '자발'})</span>
            </button>

            <!-- 단서 안내 박스 -->
            <div id="cue-display-box" style="display: none; width: 100%; max-width: 520px; padding: 0.85rem 1.2rem; border-radius: var(--radius-lg); background: var(--brand-warning-light); border: 1px solid var(--brand-warning-border); color: #B45309; font-weight: 600; font-size: 1rem;">
            </div>

            <!-- 보기 선택 버튼군 (단서 5단계 이상 시) -->
            <div id="choice-options-container" class="option-btn-grid" style="display: ${cueLevel >= 5 ? 'grid' : 'none'}; margin-top: 0.4rem;">
              ${options.map(opt => `
                <button class="option-select-btn" data-val="${esc(opt)}" style="border-radius: var(--radius-pill);">
                  ${esc(opt)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 치료사 신속 판정 하단 바 (환자의 시야를 방해하지 않는 깔끔한 헤어라인 패널) -->
          <div class="clinician-touch-eval-card" style="width: 100%; max-width: 680px; background: rgba(248, 249, 250, 0.95); border: 1px solid var(--border-hairline); border-radius: var(--radius-lg); padding: 0.85rem 1.25rem; margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.4rem;">
              <span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem; letter-spacing: -0.01em;">
                👨‍⚕️ 치료사 원클릭 판정 (터치 즉시 채점)
              </span>
              <span style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">
                <span id="lbl-active-cue-name">${CUE_HIERARCHY[cueLevel]?.label || '자발 산출'}</span> (<span id="lbl-active-cue-score">${CUE_HIERARCHY[cueLevel]?.score || 100}</span>점)
              </span>
            </div>

            <div class="touch-eval-btn-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
              <button class="btn-touch-eval touch-correct" id="btn-touch-spontaneous" type="button" title="힌트 없이 스스로 성공">
                <span style="font-size: 1.1rem;">🟢</span>
                <div>
                  <strong style="font-size: 0.82rem; display: block;">자발 정답</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">100점</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-cued" id="btn-touch-cued" type="button" title="단서 확인 후 정답 발화">
                <span style="font-size: 1.1rem;">💡</span>
                <div>
                  <strong style="font-size: 0.82rem; display: block;">단서 정답</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);" id="lbl-touch-cued-pts">${cueLevel > 0 ? `${CUE_HIERARCHY[cueLevel]?.score}점` : '85점'}</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-partial" id="btn-touch-partial" type="button" title="근접 발음 또는 핵심어 산출">
                <span style="font-size: 1.1rem;">🔵</span>
                <div>
                  <strong style="font-size: 0.82rem; display: block;">부분 산출</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">70%</span>
                </div>
              </button>

              <button class="btn-touch-eval touch-incorrect" id="btn-touch-incorrect" type="button" title="오답 또는 무반응">
                <span style="font-size: 1.1rem;">🔴</span>
                <div>
                  <strong style="font-size: 0.82rem; display: block;">오답/무반응</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">0점</span>
                </div>
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

    const targetSentence = task.question || task.targetWord || '';

    // 0. 치료사/특수교사 원터치 신속 판정 버튼 바인딩
    const btnSpontaneous = container.querySelector('#btn-touch-spontaneous');
    const btnCued = container.querySelector('#btn-touch-cued');
    const btnPartial = container.querySelector('#btn-touch-partial');
    const btnIncorrect = container.querySelector('#btn-touch-incorrect');

    if (btnSpontaneous) {
      btnSpontaneous.onclick = () => {
        fillAllSyllables(container, 100);
        orch.submitAnswer(task.targetWord, 'clinician_spontaneous');
      };
    }
    if (btnCued) {
      btnCued.onclick = () => {
        if (orch.currentCueLevel === 0) {
          orch.currentCueLevel = 1;
        }
        fillAllSyllables(container, 85);
        orch.submitAnswer(task.targetWord, 'clinician_cued');
      };
    }
    if (btnPartial) {
      btnPartial.onclick = () => {
        fillAllSyllables(container, 55);
        orch.submitAnswer(task.targetWord, 'clinician_partial');
      };
    }
    if (btnIncorrect) {
      btnIncorrect.onclick = () => {
        fillAllSyllables(container, 0);
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

    // 2. 마이크 토글 (STT) + 말잇다 스타일 실시간 음절 채우기 (Real-time Syllable Fill)
    btnMic.onclick = () => {
      if (speechAgent.isRecording) {
        speechAgent.stopListening();
      } else {
        speechAgent.startListening({
          canvas,
          onResult: (transcript, isFinal, alternatives) => {
            inputText.value = transcript;
            statusLabel.innerHTML = `인식 중: <strong style="color:var(--color-accent);">"${esc(transcript)}"</strong>`;

            // 말잇다 핵심: 발음되는 음절마다 실시간으로 블루 컬러 채우기
            updateSyllableFills(container, transcript, targetSentence);

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
        updateSyllableFills(container, val, targetSentence);
        orch.submitAnswer(val, 'text');
      } else {
        statusLabel.textContent = '답안을 말씀하시거나 입력창에 적어주세요.';
      }
    };

    inputText.oninput = () => {
      updateSyllableFills(container, inputText.value, targetSentence);
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
          <div style="${cue.big ? 'font-size: 1.6rem; letter-spacing: 0.08em; color: var(--text-primary);' : ''}">${esc(cue.text)}</div>
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
        updateSyllableFills(container, val, targetSentence);
        orch.submitAnswer(val, 'choice');
      };
    });
  }

  // 평가 완료 피드백 화면 표시 (말잇다 감성 정갈한 알림 배너)
  function showFeedback(data) {
    const { evaluation, adaptResult, isLast } = data;
    const bannerBox = container.querySelector('#evaluation-banner-container');
    if (!bannerBox) return;

    const bannerClass = evaluation.status === 'CORRECT' ? 'correct' : (evaluation.status === 'PARTIAL' ? 'partial' : 'incorrect');

    bannerBox.innerHTML = `
      <div class="feedback-banner ${bannerClass}" style="border-radius: var(--radius-lg); box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <div style="flex: 1;">
          <div style="font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em;">${esc(evaluation.feedbackTitle)}</div>
          <div style="font-size: 0.95rem; margin-top: 0.25rem; opacity: 0.95; line-height: 1.5;">${esc(evaluation.feedbackMsg)}</div>
          <div style="font-size: 0.85rem; margin-top: 0.4rem; display: flex; gap: 0.85rem; flex-wrap: wrap; font-weight: 600;">
            <span>인식 발화: <strong style="color:var(--text-primary);">"${esc(evaluation.userResponse || '무응답')}"</strong></span>
            <span>단서 점수: <strong>${evaluation.score}점</strong></span>
            <span>반응 잠복기: ${sec(evaluation.latencyMs)}초</span>
            ${evaluation.ambiguousStt ? `<span style="color: #D97706; background: #FEF3C7; padding: 0.15rem 0.6rem; border-radius: var(--radius-pill); font-weight: 700;">⚠️ STT 모호 (하단 버튼으로 즉시 정정 가능)</span>` : ''}
            ${adaptResult.action !== 'HOLD' ? `<span style="color: var(--brand-purple); font-weight: 800;">${adaptResult.reason}</span>` : ''}
          </div>
        </div>

        <button class="btn btn-primary btn-pill" id="btn-next-step" style="white-space: nowrap;">
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

  // 세션 종료 결과 요약 화면 (말잇다 스코어 스토리 및 메트릭스 스타일)
  function showSummary(data) {
    const { report } = data;

    container.innerHTML = `
      <div class="training-container">
        <div class="patient-training-card" style="gap: 2.2rem; padding: 3rem 2.2rem;">
          <div>
            <span class="rehab-pill-badge" style="margin-bottom: 0.8rem;">오늘의 재활 세션 완료</span>
            <h2 style="font-size: 2.3rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.03em; margin-bottom: 0.4rem;">
              오늘 발음 훈련을 성공적으로 마쳤습니다
            </h2>
            <p style="font-size: 1.05rem; color: var(--text-secondary); max-width: 520px; margin: 0 auto;">
              총 ${report.totalTasks}개의 문항을 소리 내어 읽으셨으며, 오늘 평균 결과가 임상 리포트에 기록되었습니다.
            </p>
          </div>

          <!-- 말잇다 스타일 4대 핵심 메트릭스 카드 (종합, 정확도, 유창성, 자발산출률) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; width: 100%; max-width: 680px;">
            <div style="background: rgba(248, 249, 250, 0.9); padding: 1.4rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-hairline); text-align: center;">
              <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.4rem;">종합 정답률</div>
              <div style="font-size: 2.6rem; font-weight: 800; color: var(--color-accent); font-family: 'Outfit', sans-serif; line-height: 1;">
                ${report.accuracy}%
              </div>
            </div>

            <div style="background: rgba(248, 249, 250, 0.9); padding: 1.4rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-hairline); text-align: center;">
              <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.4rem;">자발 산출률 (무단서)</div>
              <div style="font-size: 2.6rem; font-weight: 800; color: var(--brand-success); font-family: 'Outfit', sans-serif; line-height: 1;">
                ${report.independentRate}%
              </div>
            </div>

            <div style="background: rgba(248, 249, 250, 0.9); padding: 1.4rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-hairline); text-align: center;">
              <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.4rem;">평균 반응 속도</div>
              <div style="font-size: 2.6rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; line-height: 1;">
                ${sec(report.avgLatencyMs)}<span style="font-size: 1.1rem; font-weight: 600;">초</span>
              </div>
            </div>

            <div style="background: rgba(248, 249, 250, 0.9); padding: 1.4rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-hairline); text-align: center;">
              <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.4rem;">정반응 문항 수</div>
              <div style="font-size: 2.6rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; line-height: 1;">
                ${report.correctCount}<span style="font-size: 1.1rem; font-weight: 600; color: var(--text-muted);">/${report.totalTasks}</span>
              </div>
            </div>
          </div>

          <!-- 하단 말잇다 알약형 액션 버튼 -->
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 0.5rem;">
            <button class="btn btn-secondary btn-pill" id="btn-restart-session">
              ${icon('refresh', 18)} 다시 연습하기
            </button>
            <button class="btn btn-primary btn-pill shadow-glow" id="btn-view-report">
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
