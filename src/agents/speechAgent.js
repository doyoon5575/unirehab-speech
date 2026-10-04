// ==========================================================================
//  음성 에이전트 (SpeechAgent) - speechAgent.js
//  역할: Web Speech API 기반 STT(대체후보 수집)·TTS, 마이크 파형 시각화,
//        무음 타임아웃 및 권한 오류 처리
// ==========================================================================

const ERROR_MESSAGES = {
  'not-allowed': '마이크 권한이 차단되어 있습니다. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해 주세요.',
  'service-not-allowed': '이 환경에서는 음성 인식이 허용되지 않습니다. 직접 입력을 이용해 주세요.',
  'no-speech': '음성이 감지되지 않았습니다. 마이크 가까이에서 다시 말씀해 주세요.',
  'audio-capture': '마이크 장치를 찾을 수 없습니다. 연결 상태를 확인해 주세요.',
  'network': '음성 인식 서버에 연결할 수 없습니다. 인터넷 연결을 확인하거나 직접 입력해 주세요.',
  'aborted': '음성 인식이 중단되었습니다.'
};

export class SpeechAgent {
  constructor() {
    this.name = 'SpeechAgent';
    this.recognition = null;
    this.isRecording = false;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.animationId = null;
    this.canvas = null;
    this.ctx = null;
    this.silenceTimer = null;
    this.callbacks = {};
    this.voice = null;
    this.sttSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    this.ttsSupported = 'speechSynthesis' in window;

    this.initSTT();
    this.initVoices();
  }

  initVoices() {
    if (!this.ttsSupported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      this.voice = voices.find(v => v.lang === 'ko-KR' && /google|yuna|heami|sunhi/i.test(v.name))
        || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko')) || null;
    };
    pick();
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  initSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'ko-KR';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;

    r.onstart = () => {
      this.isRecording = true;
      this.callbacks.onState?.(true);
    };
    r.onend = () => {
      this.isRecording = false;
      this.clearSilenceTimer();
      this.stopVisualizer();
      this.callbacks.onState?.(false);
    };
    r.onresult = (event) => {
      this.armSilenceTimer();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const alts = [];
        for (let k = 0; k < res.length; k++) alts.push(res[k].transcript.trim());
        if (res.isFinal) {
          this.callbacks.onResult?.(alts[0], true, alts.filter(Boolean));
        } else {
          this.callbacks.onResult?.(alts[0], false, alts.filter(Boolean));
        }
      }
    };
    r.onerror = (event) => {
      const msg = ERROR_MESSAGES[event.error] || `음성 인식 오류 (${event.error})`;
      this.callbacks.onError?.(event.error, msg);
    };
    this.recognition = r;
  }

  armSilenceTimer(ms = 8000) {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording) {
        this.callbacks.onError?.('no-speech', ERROR_MESSAGES['no-speech']);
        this.stopListening();
      }
    }, ms);
  }

  clearSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  async startListening({ canvas = null, onResult, onError, onState } = {}) {
    this.cancelSpeech();
    this.callbacks = { onResult, onError, onState };

    if (!this.recognition) {
      onError?.('unsupported', '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 권장하며, 직접 입력도 가능합니다.');
      return false;
    }
    if (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }
    try {
      this.recognition.start();
      this.armSilenceTimer();
      this.wantVisual = !!canvas;
      if (canvas) this.startVisualizer();
      return true;
    } catch (err) {
      if (err.name !== 'InvalidStateError') onError?.('start', '음성 인식을 시작할 수 없습니다.');
      return false;
    }
  }

  stopListening() {
    this.clearSilenceTimer();
    if (this.recognition && this.isRecording) {
      try { this.recognition.stop(); } catch (e) { /* noop */ }
    }
    this.isRecording = false;
    this.stopVisualizer();
  }

  async startVisualizer() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no media');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.wantVisual) { stream.getTracks().forEach(t => t.stop()); return; }
      this.mediaStream = stream;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      src.connect(this.analyser);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const draw = () => {
        if (!this.canvas || !this.analyser) return;
        this.animationId = requestAnimationFrame(draw);
        this.analyser.getByteFrequencyData(data);
        this.paintBars(Array.from(data).map(v => v / 255));
      };
      draw();
    } catch (e) {
      if (this.wantVisual) this.drawIdleWave();
    }
  }

  paintBars(levels) {
    const { width, height } = this.canvas;
    const c = this.ctx;
    c.clearRect(0, 0, width, height);
    const n = 24;
    const gap = 4;
    const bw = (width - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const v = levels[Math.floor((i / n) * levels.length)] || 0;
      const h = Math.max(4, v * height);
      const x = i * (bw + gap);
      const y = (height - h) / 2;
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#2F9E77');
      g.addColorStop(1, '#0B6E99');
      c.fillStyle = g;
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, bw, h, bw / 2); else c.rect(x, y, bw, h);
      c.fill();
    }
  }

  drawIdleWave() {
    if (!this.canvas) return;
    let t = 0;
    const draw = () => {
      if (!this.canvas) return;
      this.animationId = requestAnimationFrame(draw);
      t += 0.12;
      const levels = Array.from({ length: 24 }, (_, i) => 0.25 + 0.2 * Math.sin(i * 0.6 + t));
      this.paintBars(levels);
    };
    draw();
  }

  stopVisualizer() {
    this.wantVisual = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
    if (this.canvas && this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  speak(text, rate = 1.0, onEnd = null) {
    if (!this.ttsSupported || !text) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\[ \? \]/g, '빈칸'));
    u.lang = 'ko-KR';
    u.rate = Math.max(0.6, Math.min(1.4, rate));
    u.pitch = 1.0;
    if (this.voice) u.voice = this.voice;
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    window.speechSynthesis.speak(u);
  }

  cancelSpeech() {
    if (this.ttsSupported) window.speechSynthesis.cancel();
  }
}

export const speechAgent = new SpeechAgent();
