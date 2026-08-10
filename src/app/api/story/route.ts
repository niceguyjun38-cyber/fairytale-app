import { NextRequest, NextResponse } from 'next/server';

// 마크다운 기호 제거
function cleanText(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')      // 제목 기호 (#)
    .replace(/\*\*(.*?)\*\*/g, '$1')  // 굵게 (**)
    .replace(/\*(.*?)\*/g, '$1')      // 기울임 (*)
    .replace(/^[-*]\s+/gm, '')        // 목록 기호
    .replace(/`/g, '')                // 코드 기호
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { context, input, isLastPage } = await req.json();

    const systemPrompt = isLastPage
      ? '너는 아이들을 위한 따뜻한 동화 작가야. 아이나 부모가 말한 내용을 자연스럽고 따뜻한 동화체 문장으로 다듬어줘. 반드시 2~3문장으로 짧게 완성해. 이것이 마지막 장이니 이야기를 따뜻하고 행복하게 마무리해줘. 절대 "..."으로 끝내지 말고 완전한 문장으로 끝내줘. 순수한 문장만 출력하고 마크다운 기호(#, *, ** 등)나 제목은 절대 사용하지 마.'
      : '너는 아이들을 위한 따뜻한 동화 작가야. 아이나 부모가 말한 내용을 자연스럽고 따뜻한 동화체 문장으로 다듬어줘. 반드시 2~3문장으로 짧게 완성하고, 이야기가 계속 이어질 수 있도록 끝을 열어둬. 절대 3문장을 넘기지 마. 순수한 문장만 출력하고 마크다운 기호(#, *, ** 등)나 제목은 절대 사용하지 마.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `앞선 이야기: "${context}"\n\n이어서 말한 내용: "${input}"\n\n동화체로 다듬어줘.`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    return NextResponse.json({ text: cleanText(data.content[0].text) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}