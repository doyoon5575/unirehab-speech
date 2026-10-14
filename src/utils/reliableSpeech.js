// Recorded prompts first. Synthesis quality remains device-dependent.
import { speechAgent } from '../agents/speechAgent.js';
let generation = 0;
const originalCancel = speechAgent.cancelSpeech.bind(speechAgent);
speechAgent.cancelSpeech = function () {
  generation++;
  if (this.currentAudio) {
    this.currentAudio.onended = null;
    this.currentAudio.onerror = null;
  }
  originalCancel();
};
speechAgent.speak = function (input, rate = 1, onEnd = null) {
  this.cancelSpeech();
  const token = generation;
  const text = typeof input === 'object' ? String(input?.question || '') : String(input || '');
  const numericRate = Number(rate);
  const speed = Math.max(0.7, Math.min(1.3, Number.isFinite(numericRate) ? numericRate : 1));
  let id = typeof input === 'object' ? input?.id : null;
  // naming-prompt.mp3 is empty; nam-01 is the existing recorded naming prompt.
  if (text.trim() === '그림을 보고 이름을 말씀해 보세요.') id = 'nam-01';
  let completed = false;
  const finish = () => {
    if (token !== generation || completed) return;
    completed = true;
    onEnd?.();
  };
  let fallbackStarted = false;
  const fallback = () => {
    if (token !== generation || fallbackStarted || completed) return;
    fallbackStarted = true;
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    // Make fallback observable rather than silently promising natural speech.
    window.dispatchEvent(new CustomEvent('unirehab:speech-mode', { detail: { mode: 'browser', deviceDependent: true } }));
    this.speakWithSynthesis(text, speed, finish);
  };
  if (!id || !/^[a-z]+-\d{2}$/.test(id)) { fallback(); return; }
  const audio = new Audio(new URL(`../../audio/${id}.mp3`, import.meta.url).href);
  audio.playbackRate = speed;
  audio.preservesPitch = true;
  this.currentAudio = audio;
  audio.onended = () => {
    if (token !== generation) return;
    this.currentAudio = null;
    finish();
  };
  audio.onerror = fallback;
  try {
    const pending = audio.play();
    pending?.catch(fallback);
    window.dispatchEvent(new CustomEvent('unirehab:speech-mode', { detail: { mode: 'recorded' } }));
  } catch { fallback(); }
};
