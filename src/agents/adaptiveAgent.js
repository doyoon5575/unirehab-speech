// ==========================================================================
//  적응형 난이도 에이전트 (AdaptiveAgent) - adaptiveAgent.js
//  역할: 문항 단위 수행(정확도·단서 의존도·반응 잠복기)에 따른 실시간 난이도 조절
//        및 회기 간 차기 난이도 권고
// ==========================================================================

import { LEVEL_ORDER, levelName, mean } from '../utils/helpers.js';

const RULES = {
  UP_STREAK: 3,          // 연속 자발/최소단서 정답 시 상향
  DOWN_STREAK: 2,        // 연속 오답 시 하향
  INDEPENDENT_MAX_CUE: 1,
  SLOW_LATENCY_MS: 9000  // 정답이어도 잠복기 과다 시 상향 보류
};

export class AdaptiveAgent {
  constructor() {
    this.name = 'AdaptiveAgent';
    this.rules = RULES;
    this.reset('level2', true);
  }

  reset(level, enabled = true) {
    this.level = level;
    this.enabled = enabled;
    this.upStreak = 0;
    this.downStreak = 0;
    this.changes = [];
  }

  // 문항 결과 반영 → 결정 반환
  update(result) {
    const independent = result.isCorrect && result.cueLevel <= RULES.INDEPENDENT_MAX_CUE && result.status === 'CORRECT';
    const slow = result.latencyMs > RULES.SLOW_LATENCY_MS;

    if (independent && !slow) {
      this.upStreak++;
      this.downStreak = 0;
    } else if (!result.isCorrect) {
      this.downStreak++;
      this.upStreak = 0;
    } else {
      // 단서 의존 정답: 유지 (상·하향 카운트 초기화)
      this.upStreak = 0;
      this.downStreak = 0;
    }

    if (!this.enabled) return { action: 'HOLD', level: this.level, reason: '적응형 조절 비활성' };

    const idx = LEVEL_ORDER.indexOf(this.level);
    if (this.upStreak >= RULES.UP_STREAK && idx < LEVEL_ORDER.length - 1) {
      return this.change(LEVEL_ORDER[idx + 1], 'UP', `자발 정답 ${RULES.UP_STREAK}회 연속 → 난이도 상향`);
    }
    if (this.downStreak >= RULES.DOWN_STREAK && idx > 0) {
      return this.change(LEVEL_ORDER[idx - 1], 'DOWN', `오답 ${RULES.DOWN_STREAK}회 연속 → 난이도 하향 (좌절 방지)`);
    }

    let reason = '현 난이도 유지';
    if (independent && slow) reason = '정답이나 반응 잠복기 과다 → 상향 보류';
    else if (this.upStreak > 0) reason = `상향까지 자발 정답 ${RULES.UP_STREAK - this.upStreak}회 남음`;
    else if (this.downStreak > 0) reason = '오답 1회 — 다음 문항 관찰';
    return { action: 'HOLD', level: this.level, reason };
  }

  change(to, action, reason) {
    const from = this.level;
    this.level = to;
    this.upStreak = 0;
    this.downStreak = 0;
    const rec = { from, to, action, reason, at: Date.now() };
    this.changes.push(rec);
    return { ...rec, level: to };
  }

  // 회기 간 권고: 최근 회기 정확도와 평균 단서 수준 기반
  recommend(sessions, domain, currentLevel) {
    const recent = sessions.filter(s => s.domain === domain).slice(-2);
    if (!recent.length) {
      return { level: currentLevel, action: 'HOLD', reason: '해당 영역 수행 기록 없음 — 현재 설정 난이도로 시작 권고' };
    }
    const last = recent[recent.length - 1];
    const acc = mean(recent.map(s => s.accuracy));
    const cue = mean(recent.map(s => s.avgCueLevel ?? (s.hintUsedCount / Math.max(1, s.totalTasks)) * 2));
    const base = last.endLevel || last.difficulty || currentLevel;
    const idx = LEVEL_ORDER.indexOf(base);

    if (acc >= 80 && cue <= 1.5 && idx < 2) {
      return { level: LEVEL_ORDER[idx + 1], action: 'UP', reason: `최근 평균 정확도 ${Math.round(acc)}%, 단서 의존 낮음 → ${levelName(LEVEL_ORDER[idx + 1])} 권고` };
    }
    if (acc < 50 && idx > 0) {
      return { level: LEVEL_ORDER[idx - 1], action: 'DOWN', reason: `최근 평균 정확도 ${Math.round(acc)}% → ${levelName(LEVEL_ORDER[idx - 1])}로 하향 권고` };
    }
    return { level: base, action: 'HOLD', reason: `최근 평균 정확도 ${Math.round(acc)}% → ${levelName(base)} 유지 권고` };
  }
}

export const adaptiveAgent = new AdaptiveAgent();
