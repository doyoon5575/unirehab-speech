// ==========================================================================
//  유니원 리햅 (UniRehab v2.0) - Vercel Serverless Function (api/generate-tasks.js)
//  역할: API Key 노출 없이 치료계획 기반 Gemini AI 맞춤형 임상 문항 생성
// ==========================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const {
    diagnosis = '실어증',
    severity = '중등도',
    category = 'sentence',       // 'naming' | 'sentence' | 'auditory' | 'pragmatics'
    difficulty = 2,              // 1(기초) | 2(중급) | 3(심화)
    therapyGoal = '',            // 예: "연결어미 '-면서'를 사용한 일상 동작 문장 완성"
    count = 10                   // 생성할 문항 수
  } = req.body || {};

  if (!therapyGoal || therapyGoal.trim().length < 2) {
    return res.status(400).json({ error: '구체적인 치료 목표(어휘 범주 또는 목표 문법 형태소)를 입력해 주세요.' });
  }

  // 기존 taskBank.js 및 CueAgent/EvalAgent와 100% 호환되는 JSON Schema 강제
  const responseSchema = {
    type: 'ARRAY',
    description: '성인 언어재활 훈련 맞춤 문항 목록',
    items: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: '환자에게 제시할 질문 또는 빈칸 문장 (예: "음악을 ___ 운동을 해요.")' },
        target: { type: 'STRING', description: '정확한 목표 정반응 어휘 또는 구절 (조사 제외한 핵심 어절, 예: "들으면서")' },
        alternatives: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '임상적으로 정답으로 인정 가능한 유의어·활용형 목록 (2~4개)'
        },
        semanticCue: { type: 'STRING', description: '1단계 의미 단서 (기능, 범주, 상황 설명)' },
        sentenceCue: { type: 'STRING', description: '2단계 문장 완성 단서 (목표 어휘 직전까지 유도하는 문맥)' },
        options: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '5단계 선택지 단서용 3지선다 보기 배열 (반드시 target을 포함하고 의미/음운 간섭 오답 2개 포함)'
        },
        imageEmoji: { type: 'STRING', description: '문항을 직관적으로 나타내는 단일 이모지 1개' },
        rationale: { type: 'STRING', description: '치료사 참고용: 이 문항이 치료 목표에 부합하는 언어학적 이유' }
      },
      required: ['prompt', 'target', 'alternatives', 'semanticCue', 'sentenceCue', 'options', 'imageEmoji', 'rationale']
    }
  };

  const systemInstruction = `
당신은 대한민국 성인 신경언어장애(실어증, 마비말장애) 및 인지-의사소통장애 전문 언어재활 임상 설계 시스템입니다.
치료사가 입력한 [환자 특성]과 [치료 목표]에 맞추어 즉시 임상 세션에 투입할 수 있는 한국어 언어재활 과제 ${count}문항을 생성하세요.

[필수 임상 규칙]
1. 아동용 말투나 유아적 어휘를 철저히 배제하고, 성인 일상생활(가정, 병원, 식사, 여가, 지역사회)에 부합하는 어휘와 문맥을 사용하세요.
2. 'target'(목표 정반응)은 한글 자모 분해 채점기(EvalAgent)와 초성/첫음절 단서 생성기(CueAgent)에 직접 입력되므로, 문장 부호나 괄호 없이 순수 한글 어휘/어절로만 작성하세요.
3. 'options'(3지선다 보기) 배열에는 반드시 'target'과 정확히 일치하는 문자열 1개와, 목표 어휘와 의미적 또는 음운적으로 유사한 오답(distractor) 2개를 포함해 총 3개를 구성하세요.
4. 난이도 기준:
  - 1단계(고빈도 기초): 2~3음절 고빈도 일상 명사/동사, 단순 단문
  - 2단계(중빈도 중급): 3~4음절 어휘, 연결어미(-고, -아서, -면서 등) 포함 복문
  - 3단계(저빈도 심화): 추상 명사, 복합 상황 추론, 화용적 대처 발화
`.trim();

  const userPrompt = `
- 환자 진단명 및 중증도: ${diagnosis} (${severity})
- 훈련 영역(category): ${category}
- 목표 난이도(difficulty): ${difficulty}단계
- 치료사 핵심 치료 목표: "${therapyGoal}"
- 요청 문항 수: ${count}개
`.trim();

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return res.status(geminiResponse.status).json({ error: `AI 모델 호출 오류: ${errText}` });
    }

    const result = await geminiResponse.json();
    const rawJsonText = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const generatedItems = JSON.parse(rawJsonText);

    return res.status(200).json({ tasks: generatedItems });
  } catch (error) {
    return res.status(500).json({ error: `문항 생성 실패: ${error.message}` });
  }
}
