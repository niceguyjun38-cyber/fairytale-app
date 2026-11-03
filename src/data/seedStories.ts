export interface SeedStory {
  id: number;
  emoji: string;
  title: string;
  theme: string;
  description: string;
  preview: string;
  /** 그림마다 똑같이 그려야 하는 주인공 설정 (영문) */
  character: string;
  /** 이야기의 배경 분위기 (영문) */
  setting: string;
  art?: string;
  firstPrompt: string;
}

export const SEED_STORIES: SeedStory[] = [
  {
    id: 1,
    emoji: '🐻',
    title: '숲속의 작은 곰',
    theme: '자연 · 모험',
    description: '숲속 오두막의 작은 곰 친구',
    preview: '어느 날 아침, 숲속 오두막에서 작은 곰이 눈을 떴어요. 오늘은 왠지 특별한 일이 생길 것 같은 느낌이 들었어요.',
    character:
      'a small round chestnut-brown bear cub with a cream muzzle, tiny round ears, shiny black eyes and a knitted sky-blue scarf, walking on two legs',
    setting: 'a misty pine forest with a little wooden cabin, fireflies and soft lantern light',
    art: '/illustrations/forest-bear.webp',
    firstPrompt: '곰이 오두막 문을 열었을 때, 앞에 무엇이 놓여 있었을까요?',
  },
  {
    id: 2,
    emoji: '⭐',
    title: '별을 모으는 아이',
    theme: '판타지',
    description: '밤하늘에서 떨어진 신기한 별',
    preview: '밤하늘에서 별 하나가 뚝 떨어졌어요. 그걸 주운 건 바로 나였어요. 별은 내 손바닥 위에서 반짝반짝 빛났어요.',
    character:
      'a six-year-old child with short messy black hair, rosy cheeks, a mustard-yellow hooded raincoat and green rain boots, holding a small glowing golden star',
    setting: 'a grassy hill under a deep blue starry night sky with distant mountains',
    art: '/illustrations/fallen-star.webp',
    firstPrompt: '손바닥 위의 별이 처음 건넨 말은 무엇이었을까요?',
  },
  {
    id: 3,
    emoji: '🍞',
    title: '마법 빵집',
    theme: '마법 · 일상',
    description: '소원을 이루는 마법 같은 빵',
    preview: '우리 동네 빵집에는 비밀이 있어요. 할머니가 만든 빵을 먹으면 딱 하루 동안 소원이 이루어진대요.',
    character:
      'a kind plump grandmother baker with silver hair in a bun, round glasses, a white apron over a green dress, and her fluffy ginger cat',
    setting: 'a cozy village bakery full of golden glowing bread, warm wooden shelves and steam',
    art: '/illustrations/magic-bakery.webp',
    firstPrompt: '마법의 빵을 한 입 먹고, 어떤 소원을 빌고 싶나요?',
  },
  {
    id: 4,
    emoji: '☁️',
    title: '구름 위 친구',
    theme: '판타지',
    description: '무지개를 만드는 하늘 친구',
    preview: '구름을 타고 하늘을 날던 중, 나는 구름 위에 사는 친구를 만났어요. 그 친구는 하늘에서 무지개를 만드는 일을 하고 있었어요.',
    character:
      'a fluffy white cloud creature with a round soft body, tiny stubby arms, pastel pink cheeks and a smiling face, holding a rainbow-colored paintbrush',
    setting: 'a dreamy sky kingdom above the clouds at sunset with rainbows',
    firstPrompt: '구름 위 친구는 무지개를 무엇으로 만들고 있었을까요?',
  },
  {
    id: 5,
    emoji: '🐠',
    title: '바닷속 탐험대',
    theme: '자연 · 모험',
    description: '신비한 바다 친구들과의 모험',
    preview: '바닷가에서 놀고 있는데, 반짝이는 물고기 한 마리가 나에게 말을 걸었어요. "우리 바다 마을에 놀러 올래?"',
    character:
      'a small friendly orange-and-white striped fish with big round eyes and shimmering golden fins',
    setting: 'a glowing underwater village of coral houses, seagrass and sunbeams',
    firstPrompt: '물고기를 따라간 바다 마을에는 어떤 집이 있었을까요?',
  },
  {
    id: 6,
    emoji: '🚀',
    title: '우주 여행',
    theme: '우주 · 모험',
    description: '작은 로켓을 타고 떠나는 우주',
    preview: '뒷마당에서 발견한 작은 로켓. 문이 스르륵 열리더니 안에서 목소리가 들렸어요. "우주 여행을 떠날 준비 됐나요?"',
    character:
      'a small round red-and-cream rocket ship with a round porthole window and a friendly little robot pilot with antenna and glowing blue eyes',
    setting: 'colorful outer space with planets, nebulae and twinkling stars',
    firstPrompt: '로켓 안에서 인사를 건넨 건 누구였을까요?',
  },
];

export type PlanId = 'free' | 'moon' | 'star';

export const PAGE_OPTIONS: { count: number; label: string; time: string; minPlan: PlanId; cost: number }[] = [
  { count: 8, label: '짧은 동화', time: '약 15분', minPlan: 'free', cost: 1 },
  { count: 12, label: '보통 동화', time: '약 25분', minPlan: 'moon', cost: 1.5 },
  { count: 15, label: '긴 동화', time: '약 35분', minPlan: 'star', cost: 2 },
];

export function canUsePages(plan: string, minPlan: PlanId) {
  if (minPlan === 'free') return true;
  if (minPlan === 'moon') return plan === 'moon' || plan === 'star';
  return plan === 'star';
}

export const PLANS = [
  {
    id: 'moon' as const,
    name: '달빛',
    price: 6900,
    credits: 8,
    tagline: '한 주에 두 권, 꾸준히',
    features: ['별가루 8개 지급', '8장 · 12장 동화', '목소리 낭독 무제한', '내 서재 평생 보관', '동화 속 영어 단어'],
  },
  {
    id: 'star' as const,
    name: '별빛',
    price: 9900,
    credits: 18,
    tagline: '매일 밤 새 이야기를',
    features: ['별가루 18개 지급', '8장 · 12장 · 15장 모두', '목소리 낭독 무제한', '내 서재 평생 보관', '연말 인기 동화 실물책 후보'],
    highlight: true,
  },
];

export const VOICES = [
  { id: 'grandpa', name: '달님 할아버지', desc: '낮고 포근하게, 천천히', emoji: '🌙' },
  { id: 'mom', name: '다정한 엄마', desc: '따뜻하고 차분하게', emoji: '🌷' },
  { id: 'sister', name: '별빛 언니', desc: '밝고 생기 있게', emoji: '✨' },
  { id: 'friend', name: '꼬마 친구', desc: '신나고 장난스럽게', emoji: '🐰' },
] as const;
export type VoiceId = (typeof VOICES)[number]['id'];
