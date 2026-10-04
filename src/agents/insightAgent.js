// ==========================================================================
//  임상 인사이트 에이전트 (InsightAgent) - insightAgent.js
//  역할: 회기 간 종단 추세 분석, 단기목표(STG) 도달 판정, 정체·하락·공백 경고
// ==========================================================================

import { DOMAINS, domainName, mean, slope, todayISO, daysBetween } from '../utils/helpers.js';

export const STG_CRITERION = { accuracy: 80, consecutive: 3 };

const PRIORITY = { danger: 0, warning: 1, success: 2, info: 3 };

export class InsightAgent {
  constructor() {
    this.name = 'InsightAgent';
  }

  analyze(patient, sessions) {
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    const target = sorted.filter(s => s.domain === patient.targetDomain);
    const insights = [];
    const push = (level, title, body) => insights.push({ level, title, body, patientId: patient.id, patientName: patient.name });

    // 영역별 프로필
    const domainProfile = {};
    Object.keys(DOMAINS).forEach(d => {
      const ds = sorted.filter(s => s.domain === d);
      domainProfile[d] = ds.length ? Math.round(mean(ds.slice(-3).map(s => s.accuracy))) : null;
    });

    if (!sorted.length) {
      push('info', '수행 기록 없음', `${patient.name} 님은 아직 회기 기록이 없습니다. 기초선(Baseline) 측정 회기를 권장합니다.`);
      return { summary: { count: 0 }, insights, domainProfile };
    }

    const last = sorted[sorted.length - 1];
    const accSeries = target.map(s => s.accuracy);
    const latSeries = target.map(s => s.avgLatencyMs || 0).filter(Boolean);
    const cueSeries = target.map(s => s.avgCueLevel).filter(v => v != null);
    const recent = target.slice(-4);

    const accSlope = slope(recent.map(s => s.accuracy));
    const latSlope = slope(latSeries.slice(-4));
    const cueSlope = slope(cueSeries.slice(-4));

    // STG 판정: 목표 영역 연속 회기 기준 도달
    let streak = 0;
    for (let i = target.length - 1; i >= 0; i--) {
      if (target[i].accuracy >= STG_CRITERION.accuracy) streak++; else break;
    }
    const stgAchieved = streak >= STG_CRITERION.consecutive;

    if (stgAchieved) {
      push('success', '단기목표(STG) 도달', `${domainName(patient.targetDomain)} 영역 ${STG_CRITERION.accuracy}% 이상 ${streak}회기 연속 달성. 목표 갱신 또는 상위 영역 확장을 검토하세요.`);
    } else if (streak > 0) {
      push('info', 'STG 진척 중', `${STG_CRITERION.accuracy}% 기준 ${streak}/${STG_CRITERION.consecutive}회기 연속 달성.`);
    }

    if (recent.length >= 3) {
      const range = Math.max(...recent.slice(-3).map(s => s.accuracy)) - Math.min(...recent.slice(-3).map(s => s.accuracy));
      if (accSlope <= -5) {
        push('danger', '수행 하락 추세', `최근 ${recent.length}회기 정반응률이 회기당 평균 ${Math.abs(accSlope).toFixed(1)}%p 하락. 컨디션·피로도·과제 난이도를 점검하세요.`);
      } else if (range <= 5 && !stgAchieved && accSeries[accSeries.length - 1] < STG_CRITERION.accuracy) {
        push('warning', '수행 정체 구간', `최근 3회기 정반응률 변동폭 ${range}%p 이내로 정체. 단서 전략 변경 또는 과제 유형 전환을 고려하세요.`);
      } else if (accSlope >= 3) {
        push('success', '정반응률 향상 추세', `최근 회기당 평균 +${accSlope.toFixed(1)}%p 향상 중입니다.`);
      }
    }

    if (latSeries.length >= 3 && latSlope <= -200) {
      push('success', '반응 잠복기 단축', `평균 반응 시간이 회기당 약 ${(Math.abs(latSlope) / 1000).toFixed(1)}초씩 단축되고 있어 인출 효율 향상이 시사됩니다.`);
    }
    if (cueSeries.length >= 3 && cueSlope <= -0.2) {
      push('success', '단서 의존도 감소', '평균 단서 수준이 감소하여 단서 소거(Fading)가 진행 중입니다.');
    } else if (cueSeries.length >= 3 && cueSlope >= 0.3) {
      push('warning', '단서 의존도 증가', '최근 평균 단서 수준이 상승했습니다. 난이도 적정성을 검토하세요.');
    }

    const gap = daysBetween(last.date, todayISO());
    if (gap >= 7) {
      push('warning', '훈련 공백', `마지막 회기 이후 ${gap}일 경과. 집중 훈련 빈도 유지를 위해 일정 조율이 필요합니다.`);
    }

    // 영역 불균형
    const scored = Object.entries(domainProfile).filter(([, v]) => v != null);
    if (scored.length >= 2) {
      scored.sort((a, b) => a[1] - b[1]);
      const [lowD, lowV] = scored[0];
      const [highD, highV] = scored[scored.length - 1];
      if (highV - lowV >= 25) {
        push('info', '영역 간 수행 격차', `${domainName(highD)}(${highV}%) 대비 ${domainName(lowD)}(${lowV}%) 수행이 낮습니다.`);
      }
    }

    insights.sort((a, b) => PRIORITY[a.level] - PRIORITY[b.level]);

    return {
      summary: {
        count: sorted.length,
        targetCount: target.length,
        lastDate: last.date,
        lastAccuracy: last.accuracy,
        recentAccuracy: recent.length ? Math.round(mean(recent.map(s => s.accuracy))) : null,
        accSlope, latSlope, cueSlope,
        stg: { achieved: stgAchieved, streak, criterion: STG_CRITERION },
        daysSinceLast: gap
      },
      insights,
      domainProfile
    };
  }

  overview(patients, allSessions) {
    const all = [];
    const byPatient = {};
    patients.forEach(p => {
      const r = this.analyze(p, allSessions.filter(s => s.patientId === p.id));
      byPatient[p.id] = r;
      all.push(...r.insights);
    });
    all.sort((a, b) => PRIORITY[a.level] - PRIORITY[b.level]);
    return { insights: all, byPatient };
  }
}

export const insightAgent = new InsightAgent();
