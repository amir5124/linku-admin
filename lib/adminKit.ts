// lib/adminKit.ts — helper bersama untuk layar admin (Mitra, Keuangan, Akun)
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export const COLORS = {
    primary: '#1477b8',
    ink: '#12222f',
    muted: '#5b6b7b',
    placeholder: '#7b8794',
    border: '#cfd9e3',
    line: '#e1e8ef',
    surface: '#f4f7fa',
    white: '#ffffff',
    danger: '#b42318',
    dangerBg: '#fdeaea',
    okFg: '#12683f',
    okBg: '#e3f6ec',
    warnFg: '#8a4a06',
    warnBg: '#fdf1e2',
    infoFg: '#0f5c91',
    infoBg: '#e6f2fb',
    neutralBg: '#e6edf3',
};

export const num = (v: any) => Number(v) || 0;
export const pad = (n: number) => String(n).padStart(2, '0');
export const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const formatDateTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const initials = (name?: string | null) =>
    (name ?? '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || 'A';

/**
 * Memanggil fungsi di api.admin dan mengembalikan isi `data` (atau responsnya).
 * Fungsi-fungsinya ada di lib/admin-api.snippet.ts — tempel ke objek `admin` di lib/api.ts.
 */
export async function adminCall<T = any>(name: string, ...args: any[]): Promise<T> {
    const fn = (api as any).admin?.[name];
    if (typeof fn !== 'function') {
        throw new Error(`api.admin.${name}() belum ada di lib/api.ts`);
    }
    const raw = await fn(...args);
    return (raw?.data ?? raw) as T;
}

/**
 * Daftar ber-halaman dengan refresh, load more, dan anti-respons-basi.
 * `key` berubah → daftar dimuat ulang dari awal. `fetchPage(offset)` harus mengembalikan { items, total, ... }.
 */
export function usePagedList<T>(
    key: string,
    fetchPage: (offset: number) => Promise<any>,
    getId: (x: any) => string = (x) => String(x?.id ?? x?.user_id)
) {
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [meta, setMeta] = useState<any>(null); // respons halaman terakhir (mis. counts)
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reqId = useRef(0);
    const fetchRef = useRef(fetchPage);
    fetchRef.current = fetchPage;

    const load = useCallback(
        async (mode: 'initial' | 'refresh' | 'more', offset = 0) => {
            const id = ++reqId.current;
            if (mode === 'initial') setLoading(true);
            if (mode === 'more') setLoadingMore(true);
            try {
                setError(null);
                const d = await fetchRef.current(offset);
                if (id !== reqId.current) return;
                const list: T[] = Array.isArray(d?.items) ? d.items : [];
                setTotal(num(d?.total));
                setMeta(d);
                setItems((prev) => {
                    if (mode !== 'more') return list;
                    const seen = new Set(prev.map(getId));
                    return [...prev, ...list.filter((x) => !seen.has(getId(x)))];
                });
            } catch (e: any) {
                if (id !== reqId.current) return;
                console.warn('[ADMIN LIST] Gagal:', e?.message);
                setError(e?.message ?? 'Gagal memuat data');
            } finally {
                if (id === reqId.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    useEffect(() => {
        load('initial');
    }, [key, load]);

    // Segarkan diam-diam saat tab kembali aktif (bukan fokus pertama)
    const focusedOnce = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (focusedOnce.current) load('refresh');
            focusedOnce.current = true;
        }, [load])
    );

    const hasMore = items.length < total;

    return {
        items,
        total,
        meta,
        loading,
        refreshing,
        loadingMore,
        error,
        hasMore,
        reload: () => load('initial'),
        silentRefresh: () => load('refresh'),
        refresh: () => {
            setRefreshing(true);
            load('refresh');
        },
        loadMore: () => {
            if (hasMore && !loading && !loadingMore && !error) load('more', items.length);
        },
    };
}