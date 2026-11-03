import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { PopularShelf } from '@/components/PopularShelf';
import { Icon, type IconName } from '@/components/Icon';
import { PLANS } from '@/data/seedStories';

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'book', title: '이야기의 문 고르기', desc: '숲속 곰, 떨어진 별, 마법 빵집… 여섯 가지 시작 중 하나를 골라요.' },
  { icon: 'mic', title: '아이가 말로 이어가기', desc: '글씨를 몰라도 괜찮아요. 마이크에 대고 "그다음엔…" 하고 말하면 돼요.' },
  { icon: 'brush', title: '그림책으로 완성', desc: '아이의 말은 동화 문장이 되고, 장면마다 그림이 그려져요.' },
  { icon: 'sound', title: '잠들기 전 읽어주기', desc: '페이지가 저절로 넘어가며 다정한 목소리로 끝까지 읽어줘요.' },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'pen', title: '아이의 말을 그대로 존중해요', desc: 'AI가 이야기를 대신 쓰지 않아요. 아이가 말한 인물과 사건을 살려 문장만 다듬고, 부모님이 직접 고칠 수도 있어요.' },
  { icon: 'sound', title: '네 가지 목소리 낭독', desc: '달님 할아버지, 다정한 엄마, 별빛 언니, 꼬마 친구. 한 번 만든 목소리는 몇 번을 들어도 무료예요.' },
  { icon: 'words', title: '내 동화로 배우는 영어', desc: '완성한 동화 속 단어 5개를 영어로 만나요. 내가 만든 이야기라 훨씬 오래 기억해요.' },
  { icon: 'library', title: '평생 남는 우리 서재', desc: '만든 그림책은 서재에 차곡차곡 쌓여요. 할머니, 할아버지께 링크로 보내 드릴 수도 있어요.' },
  { icon: 'heart', title: '친구들과 나누는 책장', desc: '원하는 이야기만 공개하면 다른 꼬마작가들이 읽고 마음을 남겨요.' },
  { icon: 'gift', title: '진짜 종이책이 될지도', desc: '한 해 동안 가장 사랑받은 이야기는 실물 그림책으로 만들어 집으로 보내드려요.' },
];

const FAQ = [
  ['몇 살부터 쓸 수 있나요?', '말로 이야기를 이어갈 수 있다면 4살 무렵부터 충분히 즐길 수 있어요. 7~9살은 직접 글로 쓰면서 더 길게 만들기도 해요. 처음에는 부모님이 옆에서 질문을 건네 주시면 훨씬 풍성해져요.'],
  ['아이가 엉뚱한 말을 해도 괜찮나요?', '그럼요. "곰이 하늘을 날아서 달에 사는 토끼를 만났어"처럼 엉뚱한 상상일수록 더 멋진 동화가 돼요. 무섭거나 폭력적인 내용은 부드러운 표현으로 다듬어져요.'],
  ['한 권 만드는 데 얼마나 걸리나요?', '8장 동화 기준 15분 남짓이에요. 이야기를 다 만들면 그림은 몇 분 안에 자동으로 완성돼요.'],
  ['별가루가 뭔가요?', '동화를 만들 때 쓰는 이용권이에요. 8장 동화는 1개, 12장은 1.5개, 15장은 2개가 필요해요. 가입하면 2개를 선물로 드려요.'],
  ['자동으로 결제되나요?', '아니요. 이용권은 30일 단위 한 번 결제예요. 자동 연장되지 않으니 필요할 때만 다시 구매하시면 돼요.'],
  ['만든 동화는 다른 사람이 볼 수 있나요?', '기본은 나만 보기로 저장돼요. 공개를 켠 이야기만 친구들 책장에 올라가고, 언제든 다시 비공개로 바꿀 수 있어요.'],
];

export default function Landing() {
  return (
    <div className="night-page">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-stars" aria-hidden="true">
            <span style={{ top: '14%', left: '12%', fontSize: 14 }}>✦</span>
            <span style={{ top: '22%', left: '84%', fontSize: 18, animationDelay: '1s' }}>✦</span>
            <span style={{ top: '62%', left: '7%', fontSize: 11, animationDelay: '1.8s' }}>✧</span>
            <span style={{ top: '70%', left: '90%', fontSize: 12, animationDelay: '0.6s' }}>✧</span>
            <span style={{ top: '38%', left: '22%', fontSize: 9, animationDelay: '2.4s' }}>⋆</span>
          </div>
          <div className="container fade-up">
            <span className="eyebrow"><Icon name="moon" size={15} /> 달빛 아래, 이야기가 깨어나는 곳</span>
            <h1 className="display">우리 아이가<br />오늘 밤의 작가예요</h1>
            <p className="lead">
              아이가 말하면 이야기가 되고, 이야기는 그림책이 돼요.<br />
              세상에 단 한 권뿐인 우리 아이의 동화를 만들어 보세요.
            </p>
            <div className="hero-actions">
              <Link href="/start" className="btn btn-gold btn-lg"><Icon name="sparkles" /> 첫 동화 무료로 만들기</Link>
              <Link href="/feed" className="btn btn-ghost btn-lg">친구들 이야기 구경하기</Link>
            </div>
            <p className="hero-note">카카오로 3초 가입 · 가입하면 그림책 2권을 만들 수 있는 별가루를 드려요</p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 20 }}>
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">✦ 이렇게 만들어져요</span>
              <h2 className="title-1">말 한마디가 한 장이 되고,<br />한 장이 한 권이 돼요</h2>
            </div>
            <div className="steps">
              {STEPS.map((s, i) => (
                <div className="step card-night" key={s.title}>
                  <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                  <div className="step-icon"><Icon name={s.icon} size={24} /></div>
                  <h3 className="title-3">{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">✦ 미리 보기</span>
              <h2 className="title-1">아이의 말이 이렇게 바뀌어요</h2>
            </div>
            <div className="sample card-paper">
              <div className="sample-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/illustrations/forest-bear.webp" alt="파란 목도리를 한 아기 곰이 반딧불이 가득한 숲길을 걷는 그림" loading="lazy" />
              </div>
              <div className="sample-page">
                <span className="tag">3번째 장 · 숲속의 작은 곰</span>
                <div className="sample-said"><b>아이가 한 말</b><br />&ldquo;곰이 반딧불이 따라가서 길을 잃었는데 반딧불이가 집에 데려다줬어&rdquo;</div>
                <p className="sample-text">작은 곰은 반짝이는 반딧불이를 따라 숲속 깊이 걸어갔어요. 정신을 차려 보니 처음 보는 길이었지요. 그때 반딧불이들이 동그랗게 모여 &ldquo;우리가 집까지 데려다줄게!&rdquo; 하고 길을 밝혀 주었어요.</p>
                <div className="sample-tools">
                  <span className="chip"><Icon name="sound" size={14} /> 목소리로 듣기</span>
                  <span className="chip"><Icon name="words" size={14} /> firefly · forest · home</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">✦ 동화공방이 특별한 이유</span>
              <h2 className="title-1">AI가 쓰는 동화가 아니라,<br />아이가 쓰는 동화예요</h2>
            </div>
            <div className="features">
              {FEATURES.map(f => (
                <div className="feature card-night" key={f.title}>
                  <div className="step-icon"><Icon name={f.icon} size={22} /></div>
                  <h3 className="title-3">{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PopularShelf />

        <section className="section" id="pricing">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">✦ 이용권</span>
              <h2 className="title-1">커피 한 잔 값으로<br />한 달 내내 그림책을</h2>
              <p className="lead">자동결제 없이 30일 단위로 구매해요. 남은 별가루는 사라지지 않아요.</p>
            </div>
            <div className="pricing">
              <div className="price-card card-night">
                <div className="price-name"><span aria-hidden="true">🌱</span><h3 className="title-3">처음 만나는 공방</h3></div>
                <p className="price">무료</p>
                <ul className="price-list">
                  <li><Icon name="check" size={16} />가입하면 별가루 2개</li>
                  <li><Icon name="check" size={16} />8장 그림책 2권</li>
                  <li><Icon name="check" size={16} />목소리 낭독 · 영어 단어</li>
                </ul>
                <Link href="/start" className="btn btn-ghost btn-block">무료로 시작하기</Link>
              </div>
              {PLANS.map(p => (
                <div key={p.id} className={`price-card card-night ${p.highlight ? 'featured' : ''}`}>
                  {p.highlight && <span className="price-badge">가장 많이 골라요</span>}
                  <div className="price-name"><span aria-hidden="true">{p.id === 'star' ? '⭐' : '🌙'}</span><h3 className="title-3">{p.name} 30일</h3></div>
                  <p className="price">{p.price.toLocaleString()}<small>원</small></p>
                  <ul className="price-list">{p.features.map(f => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul>
                  <Link href="/plans" className={`btn btn-block ${p.highlight ? 'btn-gold' : 'btn-ghost'}`}>{p.name} 이용권 보기</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container-narrow">
            <div className="section-head">
              <span className="eyebrow">✦ 자주 묻는 질문</span>
              <h2 className="title-1">궁금한 점이 있나요?</h2>
            </div>
            <div className="faq">
              {FAQ.map(([q, a]) => (
                <details key={q} className="card-night"><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 10 }}>
          <div className="container-narrow">
            <div className="cta-band card-night">
              <span className="eyebrow"><Icon name="moon" size={15} /> 오늘 밤의 이야기</span>
              <h2 className="title-1">아이의 상상이 사라지기 전에<br />한 권의 책으로 남겨 주세요</h2>
              <Link href="/start" className="btn btn-gold btn-lg"><Icon name="sparkles" /> 지금 첫 동화 만들기</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
