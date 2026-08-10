export interface SeedStory {
  id: number;
  emoji: string;
  title: string;
  theme: string;
  description: string;
  preview: string;
  character: string;
}

export const SEED_STORIES: SeedStory[] = [
  {
    id: 1,
    emoji: '🐻',
    title: '숲속의 작은 곰',
    theme: '자연/모험',
    description: '숲속 오두막의 작은 곰 친구',
    preview: '어느 날 아침, 숲속 오두막에서 작은 곰이 눈을 떴어요. 오늘은 왠지 특별한 일이 생길 것 같은 느낌이 들었어요...',
    character: 'a small cute brown bear with a blue scarf in a forest',
  },
  {
    id: 2,
    emoji: '⭐',
    title: '별을 모으는 아이',
    theme: '판타지',
    description: '밤하늘에서 떨어진 신기한 별',
    preview: '밤하늘에서 별 하나가 뚝 떨어졌어요. 그걸 주운 건 바로 나였어요. 별은 내 손바닥 위에서 반짝반짝 빛났어요...',
    character: 'a small child holding a glowing star under night sky',
  },
  {
    id: 3,
    emoji: '🍞',
    title: '마법 빵집',
    theme: '마법/일상',
    description: '소원을 이루는 마법 같은 빵',
    preview: '우리 동네 빵집에는 비밀이 있어요. 할머니가 만든 빵을 먹으면 딱 하루 동안 소원이 이루어진대요...',
    character: 'a warm cozy bakery with a kind grandmother baking bread',
  },
  {
    id: 4,
    emoji: '☁️',
    title: '구름 위 친구',
    theme: '판타지',
    description: '무지개를 만드는 하늘 친구',
    preview: '구름을 타고 하늘을 날던 중, 나는 구름 위에 사는 친구를 만났어요. 그 친구는 하늘에서 무지개를 만드는 일을 하고 있었어요...',
    character: 'a fluffy cloud creature making rainbows in the sky',
  },
  {
    id: 5,
    emoji: '🐠',
    title: '바닷속 탐험대',
    theme: '자연/모험',
    description: '신비한 바다 친구들과의 모험',
    preview: '바닷가에서 놀고 있는데, 반짝이는 물고기 한 마리가 나에게 말을 걸었어요. "우리 바다 마을에 놀러 올래?"...',
    character: 'a colorful friendly fish in a beautiful underwater world',
  },
  {
    id: 6,
    emoji: '🚀',
    title: '우주 여행',
    theme: 'SF/모험',
    description: '작은 로켓을 타고 떠나는 우주',
    preview: '뒷마당에서 발견한 작은 로켓. 문이 스르륵 열리더니 안에서 목소리가 들렸어요. "우주 여행을 떠날 준비 됐나요?"...',
    character: 'a small cute rocket ship flying through colorful space',
  },
];

export const PAGE_OPTIONS = [
  { count: 8, label: '짧은 동화', time: '15분 완성', minPlan: 'free' },
  { count: 12, label: '일반 동화', time: '25분 완성', minPlan: 'moon' },
  { count: 15, label: '긴 동화', time: '35분 완성', minPlan: 'star' },
];