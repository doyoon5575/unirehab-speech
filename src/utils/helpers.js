// ==========================================================================
//  공통 유틸리티 (helpers.js) - 보안 이스케이프, 도메인 상수, 한글 처리, UI 헬퍼
// ==========================================================================

import { icon } from './icons.js';

// ---- 1. 보안: HTML 이스케이프 (XSS 방지) ----
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- 2. 임상 도메인 / 난이도 상수 ----
export const DOMAINS = {
  naming:     { id: 'naming',     name: '어휘 인출',  full: '어휘 인출 (이름대기)',   icon: 'book',    color: '#0B6E99', desc: '시각 자극을 보고 목표 어휘를 인출하는 이름대기(Confrontation Naming) 훈련' },
  sentence:   { id: 'sentence',   name: '문장 완성',  full: '문장 완성 (구문 산출)',  icon: 'layers',  color: '#6C5DD3', desc: '문맥 빈칸 채우기를 통한 통사·형태 산출 훈련' },
  auditory:   { id: 'auditory',   name: '청각 이해',  full: '청각적 이해 (식별)',     icon: 'ear',     color: '#2F9E77', desc: '음성 설명을 듣고 대상을 판별하는 청각 이해 훈련' },
  pragmatics: { id: 'pragmatics', name: '일상 화용',  full: '일상 대화 (기능적 화용)', icon: 'message', color: '#D98B12', desc: '식당·병원·상점 등 일상 상황 기능적 의사소통 훈련' }
};

export const LEVELS = {
  level1: { id: 'level1', name: '1단계', label: '기초', order: 1 },
  level2: { id: 'level2', name: '2단계', label: '중급', order: 2 },
  level3: { id: 'level3', name: '3단계', label: '심화', order: 3 }
};

export const LEVEL_ORDER = ['level1', 'level2', 'level3'];

export const domainName = (id) => DOMAINS[id]?.name || id;
export const levelName = (id) => (LEVELS[id] ? `${LEVELS[id].name} · ${LEVELS[id].label}` : id);

// ---- 3. 한글 처리 ----
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

export function toChosung(text) {
  return [...String(text)].map(ch => {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) return CHO[Math.floor((c - 0xac00) / 588)];
    return ch === ' ' ? '  ' : ch;
  }).join(' ').replace(/\s{3,}/g, '   ');
}

export function firstSyllable(text) {
  const t = String(text).trim();
  return t ? t[0] : '';
}

// 받침 유무에 따른 조사 선택 (을/를, 이/가, 은/는, 으로/로)
export function josa(word, pair) {
  const last = String(word).trim().slice(-1);
  const c = last.charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return word + pair.split('/')[1];
  const hasJong = (c - 0xac00) % 28 !== 0;
  const [a, b] = pair.split('/');
  return word + (hasJong ? a : b);
}

// ---- 4. 날짜/숫자 포맷 ----
export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().split('T')[0];
}

export function formatDate(iso, withDay = false) {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  const opts = { month: 'long', day: 'numeric' };
  if (withDay) opts.weekday = 'short';
  return d.toLocaleDateString('ko-KR', opts);
}

export function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

export const sec = (ms) => (ms / 1000).toFixed(1);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 5. UI: 토스트 알림 ----
export function toast(message, type = 'info', duration = 2800) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const iconName = { success: 'check', error: 'alert', warning: 'alert', info: 'info' }[type] || 'info';
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast-ico">${icon(iconName, 16, 2.5)}</span><span>${esc(message)}</span>`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ---- 6. UI: 모달 ----
export function openModal({ title, iconName = 'info', body, footer = '', width = 560, onMount }) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" data-close="overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="max-width:${width}px">
        <div class="modal-head">
          <div class="modal-title"><span class="icon-chip">${icon(iconName, 18)}</span><h3>${esc(title)}</h3></div>
          <button class="btn-icon" data-close="btn" aria-label="닫기">${icon('x', 18)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
  const overlay = container.querySelector('.modal-overlay');
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => {
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { container.innerHTML = ''; }, 200);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close="btn"]')) close();
  });
  if (onMount) onMount(container.querySelector('.modal'), close);
  return close;
}

export function confirmDialog(message, { title = '확인', okText = '확인', danger = false } = {}) {
  return new Promise(resolve => {
    let decided = false;
    const close = openModal({
      title, iconName: danger ? 'alert' : 'info', width: 440,
      body: `<p class="text-body">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-act="cancel">취소</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(okText)}</button>`,
      onMount: (m, closeFn) => {
        m.querySelector('[data-act="cancel"]').onclick = () => { decided = true; resolve(false); closeFn(); };
        m.querySelector('[data-act="ok"]').onclick = () => { decided = true; resolve(true); closeFn(); };
      }
    });
    void close; void decided;
  });
}

// ---- 7. 파일 다운로드 ----
export function downloadFile(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- 8. 통계 ----
export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// 단순 선형회귀 기울기 (x = 회기 순번)
export function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = mean(values);
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
  return den ? num / den : 0;
}
