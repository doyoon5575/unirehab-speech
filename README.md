# UniRehab Speech (유니원 리햅)

성인 언어재활사의 과제 제시·훈련 기록을 지원하는 Agentic AI 기반 성인 언어재활 웹 솔루션입니다.

* **글로벌 라이브 데모**: [https://unirehab-speech.vercel.app](https://unirehab-speech.vercel.app)
* **저장소**: [https://github.com/doyoon5575/unirehab-speech](https://github.com/doyoon5575/unirehab-speech)

## 주요 기능 및 최신 아키텍처

- **생성형 AI 맞춤 문항 생성 (Gemini 2.5 Flash)**: 진단명(실어증·구음장애), 손상 영역, 난이도별 맞춤형 과제 실시간 자동 생성
- **하이브리드 동기화 (Supabase + LocalStorage)**: 온라인 환경에서는 PostgreSQL RLS 기반 클라우드 백업, 네트워크 단절 시 IndexedDB/LocalStorage 자동 오프라인 폴백
- **4대 언어재활 훈련 모듈**: 어휘 인출, 문장 완성, 청각 이해, 일상 화용 과제
- **치료사 맞춤 평가 및 단서 위계**: 시각·음운·의미 3단계 단서 제시, 반응시간 자동 측정, 치료사 직접 채점 오버라이드
- **SOAP 기록 및 임상 통계**: 세션별 수행률, 단서 의존도 분석, 임상 리포트 자동 생성
- **듀얼 보이스 오디오 시스템**: 스튜디오 품질 뉴럴 음원 우선 재생 + Web Speech TTS 폴백

## 로컬 실행

```sh
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속

## 음성 및 개인정보 보호

- Web Speech API를 활용한 실시간 음성인식(STT)은 브라우저 보안 규정에 따라 HTTPS 환경(Vercel 라이브 데모)에서 완벽히 지원됩니다.
- 외부 전송을 엄격히 제한해야 하는 폐쇄 임상 환경에서는 마이크 음성인식 대신 치료사 직접 채점 모드를 사용하실 수 있습니다.

