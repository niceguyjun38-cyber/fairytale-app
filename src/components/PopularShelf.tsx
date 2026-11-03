'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { BookCard, type BookSummary } from './BookCard';

export function PopularShelf() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  useEffect(() => {
    createClient()
      .from('fairytales')
      .select('id, title, cover_image_url, like_count, view_count, total_pages')
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setBooks(data || []), () => setBooks([]));
  }, []);

  if (!books || books.length < 2) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">✦ 동화마을 책장</span>
          <h2 className="title-1">친구들이 만든 이야기</h2>
          <p className="lead">세상에 하나뿐인 그림책들이 매일 책장에 꽂히고 있어요.</p>
        </div>
        <div className="shelf">
          {books.map(b => <BookCard key={b.id} book={b} href={`/story/${b.id}`} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link href="/feed" className="btn btn-ghost">책장 전체 둘러보기</Link>
        </div>
      </div>
    </section>
  );
}
