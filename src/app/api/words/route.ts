import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { storyText } = await req.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system:
          '너는 유아 영어 교육 전문가야. 동화 내용에서 3~7세 아이가 배우기 좋은 핵심 단어 5개를 골라줘. 반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.\n[{"korean":"곰","english":"bear","emoji":"🐻","sentence":"The bear is happy!"}]\n- korean: 동화에 나온 한국어 단어\n- english: 영어 단어 (소문자)\n- emoji: 단어를 표현하는 이모지 1개\n- sentence: 그 단어가 들어간 아주 쉬운 영어 문장',
        messages: [
          {
            role: 'user',
            content: `다음 동화에서 핵심 단어 5개를 골라줘:\n\n${storyText}`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    const words = JSON.parse(raw);

    return NextResponse.json({ words });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}