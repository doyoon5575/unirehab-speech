// ==========================================================================
//  단서 위계 에이전트 (CueAgent) - cueAgent.js
//  역할: 최소→최대 단서(Least-to-Most) 위계에 따른 단계적 단서 제공 및
//        단서 수준별 차등 점수 산정
// ==========================================================================

import { toChosung, firstSyllable } from '../utils/helpers.js';

export const CUE_HIERARCHY = [
  { level: 0, key: 'none',       label: '자발 산출',   short: '자발',  score: 100, icon: 'sparkles' },
  { level: 1, key: 'semantic',   label: '의미 단서',   short: '의미',  score: 85,  icon: 'bulb' },
  { level: 2, key: 'context',    label: '문맥 단서',   short: '문맥',  score: 75,  icon: 'message' },
  { level: 3, key: 'phonemic',   label: '초성 단서',   short: '초성',  score: 65,  icon: 'type' },
  { level: 4, key: 'syllable',   label: '첫음절 단서', short: '첫음절', score: 55,  icon: 'keyboard' },
  { level: 5, key: 'choice',     label: '보기 선택',   short: '보기',  score: 40,  icon: 'layers' },
  { level: 6, key: 'repetition', label: '따라 말하기', short: '따라',  score: 25,  icon: 'repeat' }
];

export const MAX_CUE_LEVEL = CUE_HIERARCHY.length - 1;

export class CueAgent {
  constructor() {
    this.name = 'CueAgent';
  }

  meta(level) {
    return CUE_HIERARCHY[Math.max(0, Math.min(MAX_CUE_LEVEL, level))];
  }

  // 특정 단계의 단서 내용 생성
  getCue(task, level) {
    const m = this.meta(level);
    const target = task.targetWord;
    switch (m.key) {
      case 'semantic':
        return { ...m, text: task.hints.semantic, speak: task.hints.semantic };
      case 'context':
        return { ...m, text: task.hints.context, speak: task.hints.context };
      case 'phonemic': {
        const ch = toChosung(target);
        return { ...m, text: ch, big: true, speak: `초성 힌트는 ${ch.replace(/\s+/g, ' ')} 입니다.` };
      }
      case 'syllable': {
        const fs = firstSyllable(target);
        return { ...m, text: `${fs} …`, big: true, speak: `첫 글자는 ${fs} 입니다. ${fs}…` };
      }
      case 'choice':
        return { ...m, text: '아래 보기 중에서 정답을 골라 말씀하시거나 눌러 주세요.', speak: '보기 중에서 정답을 골라 보세요.' };
      case 'repetition':
        return { ...m, text: target, big: true, speak: `저를 따라 말씀해 보세요. ${target}` };
      default:
        return { ...m, text: '', speak: '' };
    }
  }

  // 단서 수준 × 정확도 판정 → 최종 점수
  scoreFor(cueLevel, status) {
    const base = this.meta(cueLevel).score;
    if (status === 'CORRECT') return base;
    if (status === 'PARTIAL') return Math.round(base * 0.7);
    return 0;
  }

  // 단서 분포 요약 (결과 배열 → 단계별 카운트)
  distribution(results) {
    const dist = CUE_HIERARCHY.map(c => ({ level: c.level, label: c.label, short: c.short, count: 0 }));
    results.filter(r => r.isCorrect).forEach(r => { dist[r.cueLevel].count++; });
    return dist;
  }
}

export const cueAgent = new CueAgent();
