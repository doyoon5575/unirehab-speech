// ==========================================================================
//  세션 오케스트레이터 (SessionOrchestrator) - sessionOrchestrator.js
//  역할: 에이전트 7종을 총괄 조율하는 상태머신 (State Machine)
//        제시 -> 대기 -> STT/입력 -> 판정 -> 단서제공 -> 적응형조절 -> 피드백 -> 다음문항
// ==========================================================================

import { taskAgent } from './taskAgent.js';
import { cueAgent, MAX_CUE_LEVEL } from './cueAgent.js';
import { evalAgent } from './evalAgent.js';
import { adaptiveAgent } from './adaptiveAgent.js';
import { speechAgent } from './speechAgent.js';
import { reportAgent } from './reportAgent.js';
import { store } from '../store.js';

export class SessionOrchestrator {
  constructor() {
    this.name = 'SessionOrchestrator';
    this.patient = null;
    this.config = {
      domain: 'naming',
      startLevel: 'level2',
      targetCount: 10,
      adaptive: true,
      autoTts: true,
      speechRate: 1.0
    };
    
    this.state = 'IDLE'; // IDLE, PRESENTING, LISTENING, EVALUATING, CUE_GIVEN, FEEDBACK, FINISHED
    this.currentIndex = 0;
    this.currentTask = null;
    this.currentCueLevel = 0;
    this.taskStartTime = 0;
    this.usedTaskIds = new Set();
    this.results = [];
    this.levelChanges = [];
    this.options = [];
    this.listeners = new Set();
  }

  // 리스너 등록
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event, data = {}) {
    this.listeners.forEach(cb => {
      try {
        cb(event, { ...data, orchestrator: this });
      } catch (err) {
        console.error('[Orchestrator Event Error]', err);
      }
    });
  }

  // 세션 시작 초기화
  startSession(patient, options = {}) {
    this.patient = patient || store.getActivePatient();
    const settings = store.getSettings();

    this.config = {
      domain: options.domain || this.patient.targetDomain || 'naming',
      startLevel: options.difficulty || this.patient.difficulty || 'level2',
      targetCount: options.count || 10,
      adaptive: options.adaptive !== undefined ? options.adaptive : true,
      autoTts: settings.autoTts !== undefined ? settings.autoTts : true,
      speechRate: settings.speechRate || 1.0
    };

    adaptiveAgent.reset(this.config.startLevel, this.config.adaptive);
    this.currentIndex = 0;
    this.usedTaskIds.clear();
    this.results = [];
    this.levelChanges = [];
    this.state = 'PRESENTING';

    this.loadNextTask();
  }

  // 다음 문항 추출 및 제시
  loadNextTask() {
    if (this.currentIndex >= this.config.targetCount) {
      this.finishSession();
      return;
    }

    const currentLevel = adaptiveAgent.level;
    this.currentTask = taskAgent.pickOne(this.config.domain, currentLevel, this.usedTaskIds);
    if (!this.currentTask) {
      this.finishSession();
      return;
    }

    this.usedTaskIds.add(this.currentTask.id);
    this.currentCueLevel = 0;
    this.options = taskAgent.buildOptions(this.currentTask);
    this.taskStartTime = Date.now();
    this.state = 'PRESENTING';

    this.emit('TASK_LOADED', {
      index: this.currentIndex,
      total: this.config.targetCount,
      task: this.currentTask,
      currentLevel,
      cueLevel: this.currentCueLevel,
      options: this.options
    });

    if (this.config.autoTts) {
      speechAgent.speak(this.currentTask.question, this.config.speechRate);
    }
  }

  // 단서 요청 (다음 단계 단서로 승격)
  requestNextCue() {
    if (this.currentCueLevel >= MAX_CUE_LEVEL) {
      return null;
    }
    this.currentCueLevel++;
    const cueInfo = cueAgent.getCue(this.currentTask, this.currentCueLevel);
    
    this.state = 'CUE_GIVEN';
    this.emit('CUE_UPDATED', {
      cueLevel: this.currentCueLevel,
      cueInfo,
      options: this.options
    });

    if (cueInfo.speak) {
      speechAgent.speak(cueInfo.speak, this.config.speechRate);
    }

    return cueInfo;
  }

  // 발화 또는 텍스트/보기 답안 제출 처리
  submitAnswer(input, mode = 'speech') {
    if (this.state === 'EVALUATING' || this.state === 'FINISHED') return;
    this.state = 'EVALUATING';
    speechAgent.stopListening();
    speechAgent.cancelSpeech();

    const latencyMs = Math.max(200, Date.now() - this.taskStartTime);
    const alternatives = Array.isArray(input) ? input : [input];

    const evaluation = evalAgent.evaluate({
      alternatives,
      task: this.currentTask,
      cueLevel: this.currentCueLevel,
      latencyMs,
      mode
    });

    // 적응형 난이도 반영
    const adaptResult = adaptiveAgent.update(evaluation);
    if (adaptResult.action !== 'HOLD') {
      this.levelChanges.push(adaptResult);
    }

    this.results.push(evaluation);
    this.state = 'FEEDBACK';

    this.emit('EVALUATION_COMPLETED', {
      index: this.currentIndex,
      evaluation,
      adaptResult,
      isLast: this.currentIndex + 1 >= this.config.targetCount
    });

    return evaluation;
  }

  // 다음 문항으로 전진
  nextTask() {
    speechAgent.cancelSpeech();
    this.currentIndex++;
    this.loadNextTask();
  }

  // 세션 완결 처리 및 리포트 저장
  finishSession() {
    this.state = 'FINISHED';
    speechAgent.stopListening();
    speechAgent.cancelSpeech();

    const prevSessions = store.getSessions(this.patient.id);
    const prevSession = prevSessions.length ? prevSessions[prevSessions.length - 1] : null;

    const report = reportAgent.generateClinicalReport(
      this.patient,
      this.results,
      {
        domain: this.config.domain,
        startLevel: this.config.startLevel,
        endLevel: adaptiveAgent.level,
        adaptive: this.config.adaptive,
        levelChanges: this.levelChanges
      },
      prevSession
    );

    let savedSession = null;
    if (report) {
      savedSession = store.addSession(report);
    }

    this.emit('SESSION_FINISHED', {
      report,
      savedSession,
      results: this.results
    });

    return report;
  }
}

export const sessionOrchestrator = new SessionOrchestrator();
