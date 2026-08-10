import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { character, sceneText, isCover, title } = await req.json();

    const styleGuide = `EXACT SAME character in every image: ${character}. The character must have identical colors, proportions, and design. Flat pastel watercolor children's book style, soft rounded shapes, warm gentle mood, simple uncluttered background.`;

    const prompt = isCover
      ? `Children's picture book cover. ${styleGuide} Title mood: ${title}. No text in image.`
      : `Children's picture book illustration. ${styleGuide} Scene: ${sceneText.substring(0, 100)}. No text in image.`;

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1-mini',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
      }),
    });

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    // gpt-image-1 계열은 base64로 반환됨
    const b64 = data.data[0].b64_json;
    return NextResponse.json({ url: `data:image/png;base64,${b64}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}