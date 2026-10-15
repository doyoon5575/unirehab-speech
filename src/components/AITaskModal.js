// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - AI 맞춤형 문항 생성 및 검수 모달 (AITaskModal.js)
// ==========================================================================
import { store } from '../store.js';
import { generateCustomTherapyTasks } from '../agents/aiTaskGenerator.js';
import { toChosung, firstSyllable } from '../agents/cueAgent.js';

const DOMAIN_LABELS = {
  naming: '어휘 인출 (Naming)',
  sentence: '문장 완성 (Sentence)',
  auditory: '청각 이해 (Auditory)',
  pragmatics: '일상 화용 (Pragmatics)'
};

const LEVEL_MAP = {
  level1: { num: 1, label: 'Level 1 (기초·고빈도)' },
  level2: { num: 2, label: 'Level 2 (중급·중빈도)' },
  level3: { num: 3, label: 'Level 3 (심화·저빈도)' }
};

export function openAITaskModal(modalContainer, onStartSessionWithTasks = null) {
  if (!modalContainer) return;

  const activePatient = store.getActivePatient();
  const defaultDomain = activePatient?.targetDomain || 'sentence';
  const defaultLevel = activePatient?.difficulty || 'level2';
  const defaultGoal = activePatient?.goals?.stg || "연결어미 '-면서'를 활용한 일상 동시 동작 문장 완성";

  let generatedTasks = [];
  let isGenerating = false;

  function closeModal() {
    modalContainer.innerHTML = '';
  }

  function render() {
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="ai-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
        <div class="modal-card modal-card--wide" style="max-width: 860px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- 모달 헤더 -->
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color, #e2e8f0); background: #f8fafc;">
            <div>
              <span class="badge badge--primary" style="font-size: 0.75rem; margin-bottom: 0.25rem; display: inline-block; background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 700;">Agentic AI 문항 설계</span>
              <h2 id="ai-modal-title" style="margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700;">치료계획 기반 AI 맞춤형 과제 생성기</h2>
            </div>
            <button type="button" id="btn-close-ai-modal" class="btn btn--ghost" aria-label="닫기" style="font-size: 1.25rem; background: transparent; border: none; cursor: pointer; color: #64748b; padding: 0.5rem;">✕</button>
          </div>

          <!-- 모달 본문 (스크롤 영역) -->
          <div class="modal-body" style="padding: 1.5rem; overflow-y: auto; flex: 1;">
            
            <!-- 1. 대상 환자 및 치료 목표 설정 폼 -->
            <form id="ai-task-form" style="background: var(--surface-subtle, #f8fafc); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color, #e2e8f0); margin-bottom: 1.5rem;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">대상 환자</label>
                  <input type="text" value="${activePatient ? `${activePatient.name} (${activePatient.diagnosis})` : '미선택 (일반 성인 기준)'}" disabled
                    style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; background: #e2e8f0; color: #475569; font-size: 0.85rem;" />
                </div>

                <div>
                  <label for="ai-domain" style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">훈련 영역</label>
                  <select id="ai-domain" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; background: #fff;">
                    ${Object.entries(DOMAIN_LABELS).map(([key, label]) => `
                      <option value="${key}" ${key === defaultDomain ? 'selected' : ''}>${label}</option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label for="ai-difficulty" style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">목표 난이도</label>
                  <select id="ai-difficulty" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; background: #fff;">
                    ${Object.entries(LEVEL_MAP).map(([key, info]) => `
                      <option value="${key}" ${key === defaultLevel ? 'selected' : ''}>${info.label}</option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label for="ai-count" style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">생성 문항 수</label>
                  <select id="ai-count" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; background: #fff;">
                    <option value="5">5문항 (단기 점검)</option>
                    <option value="10" selected>10문항 (표준 1회기)</option>
                    <option value="15">15문항 (집중 훈련)</option>
                  </select>
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label for="ai-therapy-goal" style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">
                  핵심 치료 목표 (목표 어휘 범주, 음운 조건, 또는 목표 문법 형태소 입력)
                </label>
                <input type="text" id="ai-therapy-goal" required
                  placeholder="예: 연결어미 '-면서'를 활용한 복문 완성 / 주방용품 2~3음절 명사 인출 / 병원 진료 예약 화용 대화"
                  value="${String(defaultGoal).replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1.5px solid #0284c7; font-size: 0.95rem; background: #fff;" />
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                  <button type="button" class="btn-goal-preset" data-goal="일상 식사 및 조리 도구 2~3음절 고빈도 명사 인출" style="font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; color: #475569;">+ 주방/식사 명사</button>
                  <button type="button" class="btn-goal-preset" data-goal="연결어미 '-면서'를 사용한 동시 동작 문장 완성" style="font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; color: #475569;">+ 연결어미 '-면서'</button>
                  <button type="button" class="btn-goal-preset" data-goal="원인·이유 연결어미 '-아서/어서'를 활용한 상황 설명 문장 완성" style="font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; color: #475569;">+ 이유 '-아서/어서'</button>
                  <button type="button" class="btn-goal-preset" data-goal="병원 및 약국 방문 시 증상 표현과 요청하기 화용 발화" style="font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; color: #475569;">+ 병원/약국 화용</button>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem;">
                <span id="ai-status-msg" style="font-size: 0.85rem; color: #475569;"></span>
                <button type="submit" id="btn-generate-ai" class="btn btn-primary" ${isGenerating ? 'disabled' : ''} style="padding: 0.65rem 1.25rem; font-weight: 700; border-radius: 8px;">
                  ${isGenerating ? '⏳ AI 임상 문항 설계 중...' : '✨ 맞춤형 문항 생성하기'}
                </button>
              </div>
            </form>

            <!-- 2. 생성된 문항 미리보기 및 치료사 인라인 검수 영역 -->
            <div id="ai-preview-section">
              ${renderTaskPreviewList()}
            </div>
          </div>

          <!-- 모달 푸터 -->
          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-top: 1px solid var(--border-color, #e2e8f0); background: #f8fafc; flex-wrap: wrap; gap: 0.8rem;">
            <span style="font-size: 0.85rem; color: #64748b;">
              총 <strong>${generatedTasks.length}</strong>개 문항 준비됨 (7단계 단서 위계 및 자모 채점기 자동 연동)
            </span>
            <div style="display: flex; gap: 0.75rem;">
              <button type="button" id="btn-cancel-ai" class="btn btn-secondary" style="padding: 0.6rem 1rem;">취소</button>
              <button type="button" id="btn-save-bank" class="btn btn-secondary" ${generatedTasks.length === 0 ? 'disabled' : ''} style="padding: 0.6rem 1rem;">
                📥 문항 뱅크에 저장 (${generatedTasks.length}건)
              </button>
              <button type="button" id="btn-save-and-start" class="btn btn-primary" ${generatedTasks.length === 0 ? 'disabled' : ''} style="padding: 0.6rem 1.2rem; font-weight: 700;">
                ▶️ 저장 후 이 세트로 즉시 치료 시작
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    bindEvents();
  }

  function renderTaskPreviewList() {
    if (isGenerating) {
      return `
        <div style="text-align: center; padding: 3rem 1rem; color: #475569;">
          <div style="font-size: 2.2rem; margin-bottom: 0.75rem;">🧠</div>
          <p style="font-weight: 700; margin-bottom: 0.25rem; font-size: 1.05rem;">환자 진단 특성과 치료 목표에 맞는 문항과 7단계 단서를 구성하고 있습니다...</p>
          <p style="font-size: 0.85rem; color: #64748b;">목표 어휘 추출 → 초성/첫음절 분해 → 의미·음운 간섭 오답(3지선다) 생성 중</p>
        </div>
      `;
    }

    if (generatedTasks.length === 0) {
      const savedCount = store.getCustomTasks().length;
      return `
        <div style="text-align: center; padding: 2.5rem 1rem; border: 2px dashed #cbd5e1; border-radius: 12px; color: #64748b; background: #fafafa;">
          <p style="margin: 0 0 0.5rem 0; font-weight: 700; font-size: 1rem; color: #334155;">상단에 치료 목표를 입력하고 [맞춤형 문항 생성하기]를 눌러주세요.</p>
          <p style="margin: 0; font-size: 0.85rem;">현재 문항 뱅크에 누적 저장된 맞춤 문항: <strong>${savedCount}문항</strong></p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        ${generatedTasks.map((task, idx) => `
          <div class="ai-task-card" data-idx="${idx}" style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 1rem; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 1.35rem;">${task.emoji || task.imageEmoji || task.visualPrompt || '🗣️'}</span>
                <strong style="font-size: 0.95rem; color: #0f172a;">문항 #${idx + 1}</strong>
                <span style="font-size: 0.78rem; color: #0f766e; background: #ccfbf1; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">
                  초성: ${task.cues?.chosung || task.chosungCue || '-'} / 첫음절: ${task.cues?.firstSyllable || task.firstSyllableCue || '-'}
                </span>
              </div>
              <button type="button" class="btn-remove-task" data-idx="${idx}" style="border: none; background: #fee2e2; color: #b91c1c; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">
                삭제
              </button>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem; margin-bottom: 0.65rem;">
              <div>
                <label style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600; margin-bottom: 0.2rem;">제시 발문 (Prompt / Question)</label>
                <input type="text" class="edit-task-prompt" data-idx="${idx}" value="${String(task.question || task.prompt || '').replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600; margin-bottom: 0.2rem;">목표 정반응 (Target)</label>
                <input type="text" class="edit-task-target" data-idx="${idx}" value="${String(task.targetWord || task.target || task.answer || '').replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.45rem 0.6rem; border: 1.5px solid #0284c7; border-radius: 6px; font-weight: 700; font-size: 0.9rem; color: #0369a1;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.82rem;">
              <div>
                <label style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600; margin-bottom: 0.2rem;">1단계 의미 단서</label>
                <input type="text" class="edit-task-semantic" data-idx="${idx}" value="${String(task.hints?.semantic || task.semanticCue || '').replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600; margin-bottom: 0.2rem;">2단계 문장 완성 단서</label>
                <input type="text" class="edit-task-sentence" data-idx="${idx}" value="${String(task.hints?.context || task.sentenceCue || '').replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600; margin-bottom: 0.2rem;">5단계 3지선다 보기 (쉼표 구분)</label>
                <input type="text" class="edit-task-options" data-idx="${idx}" value="${String(task.options || []).join(', ').replace(/"/g, '&quot;')}"
                  style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem;" />
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 기존 taskBank.js 및 CueAgent/EvalAgent 규격에 맞게 정규화
  function normalizeForTaskBank(rawTasks, domainKey, levelKey, therapyGoal) {
    return rawTasks.map(t => {
      const targetWord = String(t.targetWord || t.target || t.answer || '').trim();
      const prompt = t.question || t.prompt || '';
      const alternatives = Array.isArray(t.alternatives) ? t.alternatives : (t.acceptableAnswers || []);
      const options = Array.isArray(t.options) ? t.options : [targetWord];
      const emoji = t.visualPrompt || t.imageEmoji || t.emoji || '🗣️';

      return {
        id: t.id,
        domain: domainKey,
        category: domainKey,
        difficulty: levelKey, // 'level1' | 'level2' | 'level3'
        question: prompt,
        prompt: prompt,
        title: `맞춤과제: ${targetWord}`,
        targetWord: targetWord,
        target: targetWord,
        answer: targetWord,
        acceptableAnswers: [targetWord, ...alternatives],
        alternatives: alternatives,
        acceptedAnswers: [targetWord, ...alternatives],
        visualPrompt: emoji,
        emoji: emoji,
        imageEmoji: emoji,
        options: options,
        distractors: options.filter(o => o !== targetWord),
        hints: {
          semantic: t.semanticCue || t.hints?.semantic || '',
          context: t.sentenceCue || t.hints?.context || ''
        },
        cues: {
          semantic: t.semanticCue || t.hints?.semantic || '',
          sentence: t.sentenceCue || t.hints?.context || '',
          chosung: toChosung(targetWord),
          firstSyllable: firstSyllable(targetWord)
        },
        chosungCue: toChosung(targetWord),
        firstSyllableCue: firstSyllable(targetWord),
        therapyGoal,
        patientId: activePatient?.id || null,
        isCustomAI: true,
        createdAt: new Date().toISOString()
      };
    });
  }

  function syncInlineEditsFromDOM() {
    const cards = modalContainer.querySelectorAll('.ai-task-card');
    cards.forEach(card => {
      const idx = Number(card.dataset.idx);
      const item = generatedTasks[idx];
      if (!item) return;

      const newPrompt = card.querySelector('.edit-task-prompt')?.value.trim() || item.question;
      const newTarget = card.querySelector('.edit-task-target')?.value.trim() || item.targetWord;
      const newSemantic = card.querySelector('.edit-task-semantic')?.value.trim() || '';
      const newSentence = card.querySelector('.edit-task-sentence')?.value.trim() || '';
      const newOptionsRaw = card.querySelector('.edit-task-options')?.value || '';
      const parsedOptions = newOptionsRaw.split(',').map(s => s.trim()).filter(Boolean);

      item.question = newPrompt;
      item.prompt = newPrompt;
      item.targetWord = newTarget;
      item.target = newTarget;
      item.answer = newTarget;
      item.hints = {
        semantic: newSemantic,
        context: newSentence
      };
      item.cues = {
        semantic: newSemantic,
        sentence: newSentence,
        chosung: toChosung(newTarget),
        firstSyllable: firstSyllable(newTarget)
      };
      item.chosungCue = toChosung(newTarget);
      item.firstSyllableCue = firstSyllable(newTarget);

      const finalOptions = parsedOptions.includes(newTarget)
        ? parsedOptions.slice(0, 3)
        : [newTarget, ...parsedOptions.slice(0, 2)];
      item.options = finalOptions;
      item.distractors = finalOptions.filter(o => o !== newTarget);
    });
  }

  function bindEvents() {
    modalContainer.querySelector('#btn-close-ai-modal')?.addEventListener('click', closeModal);
    modalContainer.querySelector('#btn-cancel-ai')?.addEventListener('click', closeModal);
    modalContainer.querySelector('#ai-modal-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'ai-modal-backdrop') closeModal();
    });

    // 빠른 치료목표 프리셋 버튼
    modalContainer.querySelectorAll('.btn-goal-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = modalContainer.querySelector('#ai-therapy-goal');
        if (input) input.value = btn.dataset.goal;
      });
    });

    // 문항 개별 삭제
    modalContainer.querySelectorAll('.btn-remove-task').forEach(btn => {
      btn.addEventListener('click', () => {
        syncInlineEditsFromDOM();
        const removeIdx = Number(btn.dataset.idx);
        generatedTasks.splice(removeIdx, 1);
        render();
      });
    });

    // AI 문항 생성 폼 제출
    const form = modalContainer.querySelector('#ai-task-form');
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const domainKey = modalContainer.querySelector('#ai-domain').value;
      const levelKey = modalContainer.querySelector('#ai-difficulty').value;
      const count = Number(modalContainer.querySelector('#ai-count').value);
      const therapyGoal = modalContainer.querySelector('#ai-therapy-goal').value.trim();

      isGenerating = true;
      render();

      try {
        const rawItems = await generateCustomTherapyTasks({
          diagnosis: activePatient?.diagnosis || '성인 신경언어장애(실어증)',
          severity: activePatient?.severity || '중등도',
          category: domainKey,
          difficulty: LEVEL_MAP[levelKey]?.num || 2,
          therapyGoal,
          count
        });
        generatedTasks = normalizeForTaskBank(rawItems, domainKey, levelKey, therapyGoal);
      } catch (err) {
        alert(`AI 문항 생성 중 오류가 발생했습니다:\n${err.message}`);
      } finally {
        isGenerating = false;
        render();
      }
    });

    // 문항 뱅크에만 저장
    modalContainer.querySelector('#btn-save-bank')?.addEventListener('click', () => {
      syncInlineEditsFromDOM();
      store.addCustomTasks(generatedTasks);
      alert(`${generatedTasks.length}개의 맞춤형 문항이 문항 뱅크에 저장되었습니다.`);
      closeModal();
    });

    // 저장 후 즉시 치료 세션 시작
    modalContainer.querySelector('#btn-save-and-start')?.addEventListener('click', () => {
      syncInlineEditsFromDOM();
      store.addCustomTasks(generatedTasks);
      const first = generatedTasks[0];
      const sessionConfig = {
        domain: first.domain,
        difficulty: first.difficulty,
        adaptive: true,
        taskCount: generatedTasks.length,
        customTaskSet: generatedTasks // 생성된 세트를 최우선 출제
      };
      closeModal();
      if (typeof onStartSessionWithTasks === 'function') {
        onStartSessionWithTasks(sessionConfig);
      }
    });
  }

  render();
}
