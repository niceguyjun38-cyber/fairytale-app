/** 링크 공유: 휴대폰은 공유 시트(카카오톡 등), PC는 링크 복사. 사용자에게 보여줄 메시지를 돌려줘요. */
export async function shareStory(storyId: string, title: string): Promise<string | null> {
  const url = `${window.location.origin}/story/${storyId}`;
  const text = `우리 아이가 직접 만든 그림책 「${title}」을 읽어 보세요!`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return null;
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return null;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return '링크를 복사했어요. 카카오톡에 붙여 넣어 보내 보세요!';
  } catch {
    window.prompt('아래 링크를 복사해 주세요', url);
    return null;
  }
}
