'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase';

const AFTER_LOGIN = 'dh:afterLogin';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!alive) return;
        setUser(data.user);
        setLoading(false);
        // 로그인 전 보던 화면으로 돌려보내요
        if (data.user) {
          try {
            const next = localStorage.getItem(AFTER_LOGIN);
            if (next) {
              localStorage.removeItem(AFTER_LOGIN);
              if (next !== window.location.pathname + window.location.search) window.location.replace(next);
            }
          } catch {}
        }
      })
      .catch(() => {
        if (alive) {
          setUser(null);
          setLoading(false);
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithKakao = async (next?: string) => {
    try {
      localStorage.setItem(AFTER_LOGIN, next ?? window.location.pathname + window.location.search);
    } catch {}
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'profile_nickname profile_image',
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    window.location.href = '/';
  };

  return { user, loading, signInWithKakao, signOut };
}

/** 플랜과 별가루 */
export function useWallet(user: User | null) {
  const [wallet, setWallet] = useState<{ plan: string; credits: number; planExpiresAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch('/api/credits', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error);
        return d;
      })
      .then(d => alive && (setWallet({ plan: d.plan, credits: Number(d.credits) || 0, planExpiresAt: d.planExpiresAt }), setError('')))
      .catch(() => alive && setError('별가루 정보를 불러오지 못했어요.'));
    return () => {
      alive = false;
    };
  }, [user, tick]);
  return { wallet: user ? wallet : null, walletError: user ? error : '', refreshWallet: () => setTick(t => t + 1), setWallet };
}
