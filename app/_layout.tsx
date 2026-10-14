// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { getToken } from '../lib/api';

export default function RootLayout() {
  const [hasToken, setHasToken] = useState(false);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Re-check token setiap kali route berubah
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getToken();
        if (cancelled) return;
        console.log('[LAYOUT] Token:', t ? '✅' : '❌', '| seg:', segments[0] ?? '(root)');
        setHasToken(!!t);
      } catch (e) {
        console.warn('[LAYOUT] getToken error:', e);
        setHasToken(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [segments]);

  useEffect(() => {
    if (!ready) return;

    const seg = segments[0];
    const inAuth = seg === '(auth)';
    const inTabs = seg === '(tabs)';
    const isRoot = seg === undefined;

    console.log('[LAYOUT] Guard:', { hasToken, inAuth, inTabs, isRoot, seg: seg ?? '(root)' });

    // 1. Belum login → paksa ke login
    if (!hasToken && !inAuth) {
      console.log('[LAYOUT] → /login');
      router.replace('/(auth)/login' as any);
      return;
    }

    // 2. Sudah login di root ATAU di login → paksa ke tabs
    if (hasToken && (isRoot || inAuth)) {
      console.log('[LAYOUT] → /(tabs)');
      router.replace('/(tabs)' as any);
      return;
    }

    // 3. Sisanya biarkan (sudah login di tabs, atau belum login di auth)
  }, [ready, hasToken, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}