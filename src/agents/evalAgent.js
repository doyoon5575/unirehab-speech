// ==========================================================================
//  수행 판정 에이전트 (EvalAgent) - evalAgent.js
//  역할: STT 대체후보 전체 평가, 자모 단위 음운 유사도, 오류 유형 분류
// ==========================================================================

import { TASK_BANK } from '../data/taskBank.js';
import { cueAgent } from './cueAgent.js';
import { josa } from '../utils/helpers.js';

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSUNG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 응답 말미의 종결어미·조사 (명사 응답 판정 시 제거)
const TRAILING = ['이에요', '이예요', '입니다', '예요', '에요', '이요', '이죠', '죠', '요', '이', '가', '은', '는', '을', '를'];
const NO_RESPONSE_RE = /^(모르|몰라|모름|글쎄|음+|어+|아+|잘모르|기억이안|생각이안|패스)/;

export const ERROR_TYPES = {
  NONE:           { key: 'NONE',           label: '오류 없음',   color: '#2F9E77' },
  PARTIAL:        { key: 'PARTIAL',        label: '부분 산출',   color: '#0B6E99' },
  PHONEMIC:       { key: 'PHONEMIC',       label: '음소 착어',   color: '#6C5DD3' },
  SEMANTIC:       { key: 'SEMANTIC',       label: '의미 착어',   color: '#D98B12' },
  CIRCUMLOCUTION: { key: 'CIRCUMLOCUTION', label: '우회 표현',   color: '#0EA5A4' },
  NO_RESPONSE:    { key: 'NO_RESPONSE',    label: '무반응',      color: '#8592A6' },
  UNRELATED:      { key: 'UNRELATED',      label: '무관련 반응', color: '#D14343' }
};

export class EvalAgent {
  constructor() {
    this.name = 'EvalAgent';
  }

  decomposeHangul(str) {
    let out = '';
    for (const ch of str) {
      const code = ch.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const idx = code - 0xac00;
        out += CHOSUNG[Math.floor(idx / 588)] + JUNGSUNG[Math.floor((idx % 588) / 28)] + JONGSUNG[idx % 28];
      } else {
        out += ch;
      }
    }
    return out;
  }

  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  normalize(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  }

  stripTrailing(word) {
    for (const t of TRAILING) {
      if (word.length > t.length && word.endsWith(t)) return word.slice(0, -t.length);
    }
    return word;
  }

  phonSimilarity(a, b) {
    const da = this.decomposeHangul(a);
    const db = this.decomposeHangul(b);
    const max = Math.max(da.length, db.length);
    return max ? Math.max(0, 1 - this.levenshtein(da, db) / max) : 0;
  }

  // 단일 응답 문자열 분석
  analyzeOne(raw, task) {
    const clean = this.normalize(raw);
    const accepted = task.acceptableAnswers.map(a => this.normalize(a));
    const target = this.normalize(task.targetWord);

    if (!clean || NO_RESPONSE_RE.test(clean)) {
      return { status: 'INCORRECT', errorType: 'NO_RESPONSE', similarity: 0, rank: 0 };
    }

    // 1) 완전 일치 또는 어미/조사 제거 후 일치
    const tokens = (raw || '').trim().split(/\s+/).map(t => this.normalize(t)).filter(Boolean);
    const stripped = [clean, this.stripTrailing(clean), ...tokens, ...tokens.map(t => this.stripTrailing(t))];
    if (stripped.some(s => accepted.includes(s))) {
      return { status: 'CORRECT', errorType: 'NONE', similarity: 1, rank: 5 };
    }

    // 2) 응답 내 정답 포함 (2음절 이상 목표어, 예: "이건 사과예요")
    const contained = accepted.find(a => a.length >= 2 && clean.includes(a));
    if (contained) {
      return { status: 'CORRECT', errorType: 'NONE', similarity: 0.95, rank: 4 };
    }

    // 3) 화용 과제 핵심어 포함 → 부분 정답 (기능적 의사소통 인정)
    if (task.core && clean.includes(this.normalize(task.core))) {
      return { status: 'PARTIAL', errorType: 'PARTIAL', similarity: 0.75, rank: 3 };
    }

    // 4) 자모 음운 유사도 (허용 답안 중 최대값)
    const sim = Math.max(...accepted.map(a => Math.max(
      this.phonSimilarity(clean, a),
      this.phonSimilarity(this.stripTrailing(clean), a)
    )));

    // 5) 부분 산출: 목표어 앞부분 절반 이상 산출 (예: "텔레" → 텔레비전)
    const s = this.stripTrailing(clean);
    if (s.length >= 2 && target.startsWith(s) && s.length >= Math.ceil(target.length / 2)) {
      return { status: 'PARTIAL', errorType: 'PARTIAL', similarity: Math.max(sim, 0.7), rank: 3 };
    }

    if (sim >= 0.75) {
      return { status: 'PARTIAL', errorType: 'PHONEMIC', similarity: sim, rank: 3 };
    }

    // 6) 의미 착어: 보기 오답 또는 동일 범주 다른 목표어 산출
    const semanticPool = new Set([
      ...(task.distractors || []).map(d => this.normalize(d)),
      ...TASK_BANK.filter(t => t.domain === task.domain && t.category === task.category && t.id !== task.id)
        .map(t => this.normalize(t.targetWord))
    ]);
    if (semanticPool.has(clean) || semanticPool.has(s)) {
      return { status: 'INCORRECT', errorType: 'SEMANTIC', similarity: sim, rank: 2 };
    }

    if (sim >= 0.5) {
      return { status: 'INCORRECT', errorType: 'PHONEMIC', similarity: sim, rank: 2 };
    }

    // 7) 우회 표현: 길게 설명했으나 목표어 미산출
    if (task.domain !== 'pragmatics' && clean.length >= 6) {
      return { status: 'INCORRECT', errorType: 'CIRCUMLOCUTION', similarity: sim, rank: 1 };
    }

    return { status: 'INCORRECT', errorType: 'UNRELATED', similarity: sim, rank: 0 };
  }

  /**
   * 다차원 종합 판정
   * @param {Object} p
   * @param {string[]} p.alternatives STT 대체 후보 또는 단일 입력
   * @param {Object} p.task
   * @param {number} p.cueLevel 0~6
   * @param {number} p.latencyMs
   * @param {'speech'|'text'|'choice'} p.mode
   */
  evaluate({ alternatives, task, cueLevel = 0, latencyMs = 0, mode = 'text' }) {
    const list = (Array.isArray(alternatives) ? alternatives : [alternatives]).filter(a => a != null);
    if (!list.length) list.push('');

    // 보기 선택 시 단서 수준을 최소 '보기 선택'으로 보정
    const effectiveCue = mode === 'choice' ? Math.max(cueLevel, 5) : cueLevel;

    let best = null;
    let bestRaw = list[0];
    list.forEach(raw => {
      const r = this.analyzeOne(raw, task);
      if (!best || r.rank > best.rank || (r.rank === best.rank && r.similarity > best.similarity)) {
        best = r;
        bestRaw = raw;
      }
    });

    const isCorrect = best.status !== 'INCORRECT';
    const score = cueAgent.scoreFor(effectiveCue, best.status);
    const fb = this.feedback(best, task, effectiveCue);

    return {
      taskId: task.id,
      domain: task.domain,
      difficulty: task.difficulty,
      targetWord: task.targetWord,
      userResponse: (bestRaw || '').trim(),
      alternatives: list,
      mode,
      status: best.status,
      isCorrect,
      errorType: best.errorType,
      similarity: Math.round(best.similarity * 100) / 100,
      cueLevel: effectiveCue,
      hintUsed: effectiveCue > 0,
      score,
      latencyMs,
      feedbackTitle: fb.title,
      feedbackMsg: fb.msg
    };
  }

  feedback(r, task, cueLevel) {
    const t = task.targetWord;
    if (r.status === 'CORRECT') {
      if (cueLevel === 0) return { title: '정확합니다', msg: `스스로 "${t}"${josa(t, '을/를').slice(t.length)} 정확히 말씀하셨습니다.` };
      if (cueLevel <= 2) return { title: '잘하셨습니다', msg: `단서를 활용해 "${t}"${josa(t, '을/를').slice(t.length)} 인출하셨습니다.` };
      return { title: '정답입니다', msg: `"${t}" — 다음에는 더 적은 단서로 도전해 보세요.` };
    }
    if (r.status === 'PARTIAL') {
      if (r.errorType === 'PHONEMIC') return { title: '거의 맞았습니다', msg: `발음이 매우 근접했습니다. "${t}"${josa(t, '이라고/라고').slice(t.length)} 또박또박 한 번 더 말해 보세요.` };
      return { title: '좋은 시도입니다', msg: `핵심을 전달하셨습니다. 완전한 표현은 "${t}"입니다.` };
    }
    const map = {
      SEMANTIC: '비슷한 범주의 다른 단어가 나왔습니다.',
      PHONEMIC: '소리가 일부 비슷했습니다.',
      CIRCUMLOCUTION: '설명은 잘 하셨습니다. 이제 단어 하나로 말해 볼까요?',
      NO_RESPONSE: '괜찮습니다. 단서를 받아 천천히 다시 해 보세요.',
      UNRELATED: '조금 다른 답이 나왔습니다.'
    };
    return { title: '다시 한 번 해 볼까요', msg: `${map[r.errorType] || ''} 정답은 "${t}"입니다.` };
  }

  // 오류 유형 분포
  errorDistribution(results) {
    const dist = {};
    Object.keys(ERROR_TYPES).forEach(k => { dist[k] = 0; });
    results.forEach(r => { dist[r.errorType] = (dist[r.errorType] || 0) + 1; });
    return dist;
  }
}

export const evalAgent = new EvalAgent();
