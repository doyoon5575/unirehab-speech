// ==========================================================================
//  과제 생성 에이전트 (TaskAgent) - taskAgent.js
//  역할: 영역·난이도별 문항 선정, 맞춤형 AI 문항 최우선 배정, 보기 구성
// ==========================================================================

import { TASK_BANK } from '../data/taskBank.js';
import { DOMAINS, LEVEL_ORDER, shuffle } from '../utils/helpers.js';

export const TASK_DOMAINS = DOMAINS;

/**
 * 치료사가 생성한 맞춤형 AI 문항(customTasks)과 기본 내장 문항(TASK_BANK) 결합 풀
 * 1순위: 맞춤형 AI 문항 (최우선 배치)
 * 2순위: 기본 96문항 뱅크
 */
export function getCombinedTaskPool(category, difficulty, customTasks = []) {
  const normCategory = (t) => t.category || t.domain;
  const normDiff = (t) => {
    const d = String(t.difficulty || '');
    if (d === 'level1' || d === '1') return 1;
    if (d === 'level2' || d === '2') return 2;
    if (d === 'level3' || d === '3') return 3;
    return d;
  };

  const reqDiff = normDiff({ difficulty });

  // 1순위: 치료사 생성 맞춤형 AI 문항
  const matchedCustom = (customTasks || []).filter(t => {
    const cMatch = !category || normCategory(t) === category;
    const dMatch = !difficulty || normDiff(t) === reqDiff;
    return cMatch && dMatch;
  });

  // 2순위: 기본 내장 문항
  const matchedBuiltIn = TASK_BANK.filter(t => {
    const cMatch = !category || normCategory(t) === category;
    const dMatch = !difficulty || normDiff(t) === reqDiff;
    return cMatch && dMatch;
  });

  return [...matchedCustom, ...matchedBuiltIn];
}

export class TaskAgent {
  constructor() {
    this.name = 'TaskAgent';
    this.bank = TASK_BANK;
  }

  pool(domain, difficulty, customTasks = []) {
    if (Array.isArray(customTasks) && customTasks.length > 0) {
      return getCombinedTaskPool(domain, difficulty, customTasks);
    }
    return this.bank.filter(t => t.domain === domain && (!difficulty || t.difficulty === difficulty));
  }

  count(domain, difficulty, customTasks = []) {
    return this.pool(domain, difficulty, customTasks).length;
  }

  stats(customTasks = []) {
    const out = {};
    Object.keys(DOMAINS).forEach(d => {
      out[d] = { total: this.count(d, null, customTasks) };
      LEVEL_ORDER.forEach(l => { out[d][l] = this.count(d, l, customTasks); });
    });
    return out;
  }

  // 단일 문항 선정: 동일 난이도 우선 → 인접 난이도 → 동일 영역 전체 (영역 이탈 금지)
  pickOne(domain, difficulty, usedIds = new Set(), customTasks = []) {
    const fresh = (list) => list.filter(t => !usedIds.has(t.id));
    const fullPool = this.pool(domain, difficulty, customTasks);
    let candidates = fresh(fullPool);

    if (!candidates.length) {
      const idx = LEVEL_ORDER.indexOf(difficulty);
      const neighbors = [LEVEL_ORDER[idx - 1], LEVEL_ORDER[idx + 1]].filter(Boolean);
      candidates = fresh(this.pool(domain, null, customTasks).filter(t => neighbors.includes(t.difficulty)));
    }
    if (!candidates.length) candidates = fresh(this.pool(domain, null, customTasks));
    if (!candidates.length) candidates = fullPool; // 전부 소진 시 재사용 허용
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  // 고정 세트 생성 (적응형 OFF 시 사용)
  generateTaskSet(domain = 'naming', difficulty = 'level2', count = 10, customTasks = []) {
    const used = new Set();
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const t = this.pickOne(domain, difficulty, used, customTasks);
      if (!t) break;
      used.add(t.id);
      tasks.push(t);
    }
    return tasks;
  }

  buildOptions(task) {
    if (Array.isArray(task.options) && task.options.length > 0) {
      return task.options;
    }
    return shuffle([task.targetWord || task.target, ...(task.distractors || []).slice(0, 3)]);
  }

  getTaskById(id, customTasks = []) {
    if (Array.isArray(customTasks)) {
      const found = customTasks.find(t => t.id === id);
      if (found) return found;
    }
    return this.bank.find(t => t.id === id) || null;
  }
}

export const taskAgent = new TaskAgent();
