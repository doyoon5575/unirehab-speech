// ==========================================================================
//  과제 생성 에이전트 (TaskAgent) - taskAgent.js
//  역할: 영역·난이도별 문항 선정, 중복 회피, 보기(distractor) 구성
// ==========================================================================

import { TASK_BANK } from '../data/taskBank.js';
import { DOMAINS, LEVEL_ORDER, shuffle } from '../utils/helpers.js';

export const TASK_DOMAINS = DOMAINS;

export class TaskAgent {
  constructor() {
    this.name = 'TaskAgent';
    this.bank = TASK_BANK;
  }

  pool(domain, difficulty) {
    return this.bank.filter(t => t.domain === domain && (!difficulty || t.difficulty === difficulty));
  }

  count(domain, difficulty) {
    return this.pool(domain, difficulty).length;
  }

  stats() {
    const out = {};
    Object.keys(DOMAINS).forEach(d => {
      out[d] = { total: this.count(d) };
      LEVEL_ORDER.forEach(l => { out[d][l] = this.count(d, l); });
    });
    return out;
  }

  // 단일 문항 선정: 동일 난이도 우선 → 인접 난이도 → 동일 영역 전체 (영역 이탈 금지)
  pickOne(domain, difficulty, usedIds = new Set()) {
    const fresh = (list) => list.filter(t => !usedIds.has(t.id));
    let candidates = fresh(this.pool(domain, difficulty));
    if (!candidates.length) {
      const idx = LEVEL_ORDER.indexOf(difficulty);
      const neighbors = [LEVEL_ORDER[idx - 1], LEVEL_ORDER[idx + 1]].filter(Boolean);
      candidates = fresh(this.bank.filter(t => t.domain === domain && neighbors.includes(t.difficulty)));
    }
    if (!candidates.length) candidates = fresh(this.pool(domain));
    if (!candidates.length) candidates = this.pool(domain, difficulty); // 전부 소진 시 재사용 허용
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  // 고정 세트 생성 (적응형 OFF 시 사용)
  generateTaskSet(domain = 'naming', difficulty = 'level2', count = 10) {
    const used = new Set();
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const t = this.pickOne(domain, difficulty, used);
      if (!t) break;
      used.add(t.id);
      tasks.push(t);
    }
    return tasks;
  }

  buildOptions(task) {
    return shuffle([task.targetWord, ...(task.distractors || []).slice(0, 3)]);
  }

  getTaskById(id) {
    return this.bank.find(t => t.id === id) || null;
  }
}

export const taskAgent = new TaskAgent();
