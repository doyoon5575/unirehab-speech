// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - AI 문항 생성기 클라이언트 모듈 (aiTaskGenerator.js)
// ==========================================================================
import { toChosung, firstSyllable } from './cueAgent.js';
import { generateId } from '../store.js';

/**
 * 한글 문자열 정제 (문장부호 제거 및 공백 정리)
 */
function sanitizeHangulTarget(str) {
  return String(str || '')
    .replace(/[.,?!~"'()[\]{}]/g, '')
    .trim();
}

/**
 * 배열 셔플 (3지선다 보기 위치 고정 방지)
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 치료계획 기반 맞춤형 문항 생성 및 정규화 실행
 */
export async function generateCustomTherapyTasks({
  diagnosis,
  severity,
  category,
  difficulty,
  therapyGoal,
  count = 10
}) {
  const response = await fetch('/api/generate-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnosis,
      severity,
      category,
      difficulty: Number(difficulty),
      therapyGoal,
      count: Number(count)
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `문항 생성 요청 실패 (HTTP ${response.status})`);
  }

  const { tasks } = await response.json();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('AI가 유효한 문항을 생성하지 못했습니다. 치료 목표를 다시 입력해 주세요.');
  }

  // 기존 taskBank.js 및 CueAgent/EvalAgent 규격에 맞게 정규화
  return tasks.map((item) => {
    const cleanTarget = sanitizeHangulTarget(item.target);
    const cleanAlternatives = (item.alternatives || [])
      .map(sanitizeHangulTarget)
      .filter(Boolean);

    // 3지선다 보기에 정답(cleanTarget)이 누락되었을 경우 강제 보정
    let options = Array.isArray(item.options) ? item.options.map(sanitizeHangulTarget) : [];
    if (!options.includes(cleanTarget)) {
      options = [cleanTarget, ...options.slice(0, 2)];
    }

    const shuffledOptions = shuffleArray(options.slice(0, 3));
    const chosung = toChosung(cleanTarget);
    const firstSyl = firstSyllable(cleanTarget);
    const emoji = item.imageEmoji || '🗣️';

    return {
      id: generateId('custom-task'),
      category,
      domain: category,
      difficulty: Number(difficulty),
      type: category === 'auditory' ? 'choice' : 'speech',
      prompt: item.prompt,
      question: item.prompt,
      target: cleanTarget,
      targetWord: cleanTarget,
      answer: cleanTarget,
      acceptableAnswers: [cleanTarget, ...cleanAlternatives],
      alternatives: cleanAlternatives,
      semanticCue: item.semanticCue,
      sentenceCue: item.sentenceCue,
      hints: {
        semantic: item.semanticCue,
        context: item.sentenceCue
      },
      cues: {
        semantic: item.semanticCue,
        sentence: item.sentenceCue,
        chosung,
        firstSyllable: firstSyl
      },
      chosungCue: chosung,
      firstSyllableCue: firstSyl,
      options: shuffledOptions,
      distractors: shuffledOptions.filter(o => o !== cleanTarget),
      visualPrompt: emoji,
      imageEmoji: emoji,
      emoji: emoji,
      rationale: item.rationale || '',
      therapyGoal,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  });
}
