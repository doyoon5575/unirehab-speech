// ==========================================================================
//  임상 리포트 에이전트 (ReportAgent) - reportAgent.js
//  역할: 회기 결과 정량 지표 산출, SOAP 자동 초안, CSV/인쇄 문서 생성
// ==========================================================================

import { cueAgent, CUE_HIERARCHY } from './cueAgent.js';
import { evalAgent, ERROR_TYPES } from './evalAgent.js';
import { domainName, levelName, todayISO, esc, mean, sec } from '../utils/helpers.js';

export class ReportAgent {
  constructor() {
    this.name = 'ReportAgent';
  }

  // 회기 결과 → 세션 레코드
  generateClinicalReport(patient, results, { domain, startLevel, endLevel, adaptive, levelChanges = [] }, prevSession = null) {
    const total = results.length;
    if (!total) return null;

    const correctCount = results.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correctCount / total) * 100);
    const independent = results.filter(r => r.isCorrect && r.cueLevel === 0).length;
    const independentRate = Math.round((independent / total) * 100);
    const avgScore = Math.round(mean(results.map(r => r.score)));
    const latencies = results.map(r => r.latencyMs).filter(l => l > 0);
    const avgLatencyMs = latencies.length ? Math.round(mean(latencies)) : 0;
    const avgCueLevel = Math.round(mean(results.map(r => r.cueLevel)) * 10) / 10;
    const hintUsedCount = results.filter(r => r.cueLevel > 0).length;
    const cueDistribution = CUE_HIERARCHY.map(c => results.filter(r => r.cueLevel === c.level).length);
    const errorDistribution = evalAgent.errorDistribution(results);

    const metrics = { total, correctCount, accuracy, independentRate, avgScore, avgLatencyMs, avgCueLevel, hintUsedCount, cueDistribution, errorDistribution };

    const soap = {
      s: this.draftSubjective(patient, results),
      o: this.objective(domain, startLevel, endLevel, metrics, levelChanges),
      a: this.assessment(metrics, prevSession, patient),
      p: this.plan(metrics, domain, endLevel, adaptive)
    };

    return {
      patientId: patient.id,
      date: todayISO(),
      domain,
      difficulty: startLevel,
      endLevel,
      adaptive,
      levelChanges,
      totalTasks: total,
      correctCount,
      accuracy,
      independentRate,
      avgScore,
      avgLatencyMs,
      avgCueLevel,
      hintUsedCount,
      cueDistribution,
      errorDistribution,
      results,
      soap
    };
  }

  draftSubjective(patient, results) {
    const skips = results.filter(r => r.errorType === 'NO_RESPONSE').length;
    const slow = results.filter(r => r.latencyMs > 10000).length;
    let s = `[자동 초안 · 치료사 확인 필요] ${patient.name} 님 회기 참여 완료.`;
    if (skips >= Math.ceil(results.length / 3)) s += ' 무반응/건너뛰기 빈도가 높아 피로 또는 동기 저하 여부 확인 요망.';
    else if (slow >= Math.ceil(results.length / 3)) s += ' 반응 지연 문항이 다수 관찰되어 컨디션·주의집중 상태 확인 요망.';
    else s += ' 과제 수행 태도 전반적으로 안정적.';
    return s;
  }

  objective(domain, startLevel, endLevel, m, changes) {
    const dominant = this.dominantError(m.errorDistribution);
    let o = `${domainName(domain)} 영역 ${m.total}문항 수행. 정반응 ${m.correctCount}문항(${m.accuracy}%), `
      + `자발 산출(무단서) ${m.independentRate}%, 단서 가중 평균점수 ${m.avgScore}점. `
      + `평균 단서 수준 ${m.avgCueLevel}/6, 평균 반응 잠복기 ${sec(m.avgLatencyMs)}초.`;
    if (changes.length) {
      o += ` 난이도 ${levelName(startLevel)} → ${levelName(endLevel)} (회기 중 ${changes.length}회 자동 조정).`;
    } else {
      o += ` 난이도 ${levelName(startLevel)} 유지.`;
    }
    if (dominant) o += ` 주요 오류 유형: ${ERROR_TYPES[dominant].label}.`;
    return o;
  }

  assessment(m, prev, patient) {
    const parts = [];
    if (m.accuracy >= 80) parts.push('정반응률이 회기 목표 기준(80%)에 도달함.');
    else if (m.accuracy >= 60) parts.push('기본 인출은 가능하나 단서 의존적 수행이 관찰됨.');
    else parts.push('자발 인출에 현저한 어려움이 있어 단서 위계 상위 단계의 지원이 필요함.');

    if (m.avgCueLevel <= 1) parts.push('단서 의존도가 낮아 독립적 산출 능력이 양호함.');
    else if (m.avgCueLevel <= 3) parts.push('의미·문맥·초성 단서 수준에서 반응성이 확인되어 음운 인출 경로 활용이 유효함.');
    else parts.push('보기 선택 및 따라 말하기 등 고단계 단서에 의존하는 경향이 큼.');

    const dominant = this.dominantError(m.errorDistribution);
    const errText = {
      PHONEMIC: '음소 착어 비중이 높아 음운 부호화 단계의 어려움이 시사됨.',
      SEMANTIC: '의미 착어 비중이 높아 의미 체계 접근의 어려움이 시사됨.',
      CIRCUMLOCUTION: '우회 표현이 빈번하여 어휘 의미는 보존되나 음운 형태 인출 곤란이 시사됨.',
      NO_RESPONSE: '무반응 비중이 높아 과제 난이도 및 피로도 재검토가 필요함.'
    };
    if (dominant && errText[dominant]) parts.push(errText[dominant]);

    if (prev) {
      const diff = m.accuracy - prev.accuracy;
      if (Math.abs(diff) >= 5) parts.push(`직전 회기 대비 정반응률 ${diff > 0 ? '+' : ''}${diff}%p 변화.`);
      else parts.push('직전 회기와 유사한 수행 수준 유지.');
    }
    return parts.join(' ');
  }

  plan(m, domain, endLevel, adaptive) {
    if (m.accuracy >= 80 && m.avgCueLevel <= 1.5) {
      return `차기 회기 ${domainName(domain)} 난이도 상향 또는 상위 영역(문장·화용)으로 일반화 확장 권고. 가정 내 자율 반복 훈련 병행.`;
    }
    if (m.accuracy >= 60) {
      return `${levelName(endLevel)} 유지, 단서 수준 점진적 감소(Fading) 목표. 의미 자질 분석(SFA) 등 인출 전략 훈련 병행 고려.${adaptive ? '' : ' 적응형 난이도 조절 활성화 권고.'}`;
    }
    return '난이도 1단계 하향 및 회기당 문항 수 5~7개로 조정하여 피로도 관리. 다감각 단서(시각+청각+초성) 조기 제공 권고.';
  }

  dominantError(dist) {
    const entries = Object.entries(dist || {}).filter(([k, v]) => k !== 'NONE' && k !== 'PARTIAL' && v > 0);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  // CSV 내보내기 (UTF-8 BOM, Excel 호환)
  exportToCSV(sessions, patient) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['회기ID', '날짜', '대상자', '진단명', '훈련영역', '시작난이도', '종료난이도', '총문항', '정반응', '정반응률(%)',
      '자발산출률(%)', '평균점수', '평균단서수준', '평균반응시간(초)', 'S', 'O', 'A', 'P'];
    const rows = sessions.map(s => [
      s.id, s.date, patient?.name, patient?.diagnosis, domainName(s.domain), levelName(s.difficulty), levelName(s.endLevel || s.difficulty),
      s.totalTasks, s.correctCount, s.accuracy, s.independentRate ?? '', s.avgScore ?? '', s.avgCueLevel ?? '', sec(s.avgLatencyMs || 0),
      s.soap?.s, s.soap?.o, s.soap?.a, s.soap?.p
    ].map(q).join(','));
    return '\uFEFF' + [headers.map(q).join(','), ...rows].join('\r\n');
  }

  // 인쇄용 임상 기록지
  printSession(session, patient, therapist = '') {
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) return false;
    const cueRows = CUE_HIERARCHY.map((c, i) => `<td>${session.cueDistribution?.[i] ?? 0}</td>`).join('');
    const resultRows = (session.results || []).map((r, i) => `
      <tr><td>${i + 1}</td><td>${esc(r.targetWord)}</td><td>${esc(r.userResponse || '-')}</td>
      <td>${r.isCorrect ? '○' : '×'}</td><td>${esc(cueAgent.meta(r.cueLevel).short)}</td>
      <td>${esc(ERROR_TYPES[r.errorType]?.label || '-')}</td><td>${r.score}</td><td>${sec(r.latencyMs)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>임상 기록지 - ${esc(patient.name)} ${esc(session.date)}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
      <style>
        body{font-family:Pretendard,sans-serif;color:#0F1E33;padding:32px 40px;font-size:13px;line-height:1.6}
        h1{font-size:20px;margin:0 0 4px} .sub{color:#4A5A70;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin:8px 0 18px} th,td{border:1px solid #CBD5E1;padding:6px 8px;text-align:center}
        th{background:#EEF4F8;font-weight:700} .soap td{text-align:left} .soap th{width:48px}
        h2{font-size:14px;border-left:4px solid #0B6E99;padding-left:8px;margin:18px 0 6px}
        .sign{margin-top:32px;display:flex;justify-content:flex-end;gap:40px}
        .note{font-size:11px;color:#64748B;margin-top:18px}
      </style></head><body>
      <h1>언어재활 회기 기록지</h1>
      <div class="sub">UniRehab Speech · 출력일 ${todayISO()}</div>
      <table><tr><th>대상자</th><td>${esc(patient.name)} (${esc(patient.age)}세, ${esc(patient.gender)})</td><th>회기일</th><td>${esc(session.date)}</td></tr>
      <tr><th>진단</th><td colspan="3">${esc(patient.diagnosis)}</td></tr>
      <tr><th>훈련 영역</th><td>${esc(domainName(session.domain))}</td><th>난이도</th><td>${esc(levelName(session.difficulty))} → ${esc(levelName(session.endLevel || session.difficulty))}</td></tr></table>
      <h2>정량 지표</h2>
      <table><tr><th>총 문항</th><th>정반응률</th><th>자발 산출률</th><th>평균 점수</th><th>평균 단서 수준</th><th>평균 잠복기</th></tr>
      <tr><td>${session.totalTasks}</td><td>${session.accuracy}%</td><td>${session.independentRate ?? '-'}%</td><td>${session.avgScore ?? '-'}</td><td>${session.avgCueLevel ?? '-'}</td><td>${sec(session.avgLatencyMs || 0)}초</td></tr></table>
      <h2>단서 수준 분포 (문항 수)</h2>
      <table><tr>${CUE_HIERARCHY.map(c => `<th>${esc(c.short)}</th>`).join('')}</tr><tr>${cueRows}</tr></table>
      ${resultRows ? `<h2>문항별 수행</h2><table><tr><th>#</th><th>목표어</th><th>반응</th><th>정오</th><th>단서</th><th>오류 유형</th><th>점수</th><th>잠복기(초)</th></tr>${resultRows}</table>` : ''}
      <h2>SOAP 기록</h2>
      <table class="soap"><tr><th>S</th><td>${esc(session.soap?.s)}</td></tr><tr><th>O</th><td>${esc(session.soap?.o)}</td></tr>
      <tr><th>A</th><td>${esc(session.soap?.a)}</td></tr><tr><th>P</th><td>${esc(session.soap?.p)}</td></tr></table>
      <div class="sign"><div>담당 언어재활사: ${esc(therapist || '____________')}</div><div>서명: ____________</div></div>
      <div class="note">※ 본 기록의 SOAP는 규칙 기반 자동 초안이며, 최종 임상 판단은 담당 언어재활사의 검토를 거쳐야 합니다. 점수는 자체 단서 가중 척도이며 표준화 검사 점수가 아닙니다.</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script>
      </body></html>`);
    w.document.close();
    return true;
  }
}

export const reportAgent = new ReportAgent();
