import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export type BookSummary = {
  id: string;
  title: string;
  cover_image_url: string | null;
  like_count: number;
  view_count?: number;
  total_pages: number;
  is_public?: boolean;
};

export function BookCard({ book, href, badge, rank, liked, onLike, children }: {
  book: BookSummary;
  href: string;
  badge?: string;
  rank?: number;
  liked?: boolean;
  onLike?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="book-card">
      <Link href={href} className="book-cover" aria-label={`${book.title} 읽기`}>
        {book.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_image_url} alt="" loading="lazy" />
        ) : (
          <span className="placeholder" aria-hidden="true">📖</span>
        )}
        {rank ? <span className="book-badge rank">{rank}위</span> : badge ? <span className="book-badge">{badge}</span> : null}
      </Link>
      <div className="book-info">
        <Link href={href}><h3>{book.title}</h3></Link>
        <div className="book-meta">
          <span>{book.total_pages}장{typeof book.view_count === 'number' ? ` · 읽음 ${book.view_count}` : ''}</span>
          {onLike ? (
            <button className={`like-btn ${liked ? 'on' : ''}`} onClick={onLike} aria-pressed={!!liked} aria-label={liked ? '좋아요 취소' : '좋아요'}>
              <Icon name="heart" size={14} filled={liked} /> {book.like_count}
            </button>
          ) : (
            <span className="like-btn" aria-label={`좋아요 ${book.like_count}개`}><Icon name="heart" size={14} /> {book.like_count}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
