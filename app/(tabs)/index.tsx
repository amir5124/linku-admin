// app/(tabs)/index.tsx — Beranda admin Waruung
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

const COLORS = {
    primary: '#1477b8',
    ink: '#12222f',
    muted: '#5b6b7b',
    line: '#e1e8ef',
    surface: '#f4f7fa',
    white: '#ffffff',
    barOff: '#cfe6f7',
    warnText: '#8a4a06',
    warnBg: '#fdf1e2',
    infoText: '#0f5c91',
    infoBg: '#e6f2fb',
};

// ============================================================
// DATA
// ============================================================
type Dashboard = {
    ordersToday: number;
    commissionToday: number;
    commissionTotal: number;
    activePartners: number;
    pendingMerchants: number;
    pendingDrivers: number;
    pendingVerification: number;
    pendingWithdrawals: number;
    days: { date: string; count: number }[]; // 7 hari, terlama → hari ini
};

const num = (v: any) => Number(v) || 0;

function normalize(raw: any): Dashboard {
    const d = raw?.data ?? raw ?? {};
    const pv = d.pending_verification ?? {};
    return {
        ordersToday: num(d.orders_today),
        commissionToday: num(d.commission_today),
        commissionTotal: num(d.commission_total),
        activePartners: num(d.active_partners),
        pendingMerchants: num(pv.merchants),
        pendingDrivers: num(pv.drivers),
        pendingVerification: num(pv.total ?? num(pv.merchants) + num(pv.drivers)),
        pendingWithdrawals: num(d.pending_withdrawals),
        days: Array.isArray(d.orders_last_7_days)
            ? d.orders_last_7_days.map((x: any) => ({ date: String(x.date), count: num(x.count) }))
            : [],
    };
}

async function fetchDashboard(): Promise<Dashboard> {
    const fn = (api as any).admin?.dashboard;
    if (typeof fn !== 'function') {
        throw new Error('Endpoint dashboard admin belum tersedia. Tambahkan api.admin.dashboard().');
    }
    return normalize(await (api as any).admin.dashboard());
}

// ============================================================
// HELPERS TAMPILAN
// ============================================================
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const dayShort = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return DAY_SHORT[new Date(y, m - 1, d).getDay()] ?? '';
};

const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
};

const initials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || 'A';

/** 1.900.000 → "Rp1,9 jt", 450.000 → "Rp450 rb" */
const rupiahCompact = (n: number) => {
    if (n >= 1_000_000) return 'Rp' + (n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '') + ' jt';
    if (n >= 1_000) return 'Rp' + Math.round(n / 1_000) + ' rb';
    return 'Rp' + Math.round(n);
};

const BAR_MAX = 92;

// ============================================================
// SCREEN
// ============================================================
export default function BerandaScreen() {
    const [data, setData] = useState<Dashboard | null>(null);
    const [adminName, setAdminName] = useState('Admin Waruung');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const [d, rawProfile] = await Promise.all([
                fetchDashboard(),
                AsyncStorage.getItem('profile').catch(() => null),
            ]);
            setData(d);
            if (rawProfile) {
                const p = JSON.parse(rawProfile);
                if (p?.full_name) setAdminName(p.full_name);
            }
        } catch (e: any) {
            console.warn('[BERANDA ADMIN] Gagal:', e?.message);
            setError(e?.message ?? 'Gagal memuat data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    // ── Loading / error ──
    if (loading) {
        return (
            <SafeAreaView edges={['top']} style={[s.container, s.center]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    if (error && !data) {
        return (
            <SafeAreaView edges={['top']} style={[s.container, s.center]}>
                <Ionicons name="cloud-offline-outline" size={44} color={COLORS.muted} />
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity
                    style={s.retryBtn}
                    onPress={() => {
                        setLoading(true);
                        load();
                    }}
                >
                    <Text style={s.retryText}>Coba Lagi</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (!data) return null;

    const maxCount = Math.max(...data.days.map((d) => d.count), 0);
    const barHeight = (c: number) => (maxCount === 0 ? 6 : Math.max(6, Math.round((c / maxCount) * BAR_MAX)));

    const actions = [
        {
            label: 'Verifikasi merchant baru',
            count: data.pendingMerchants,
            tone: 'warn' as const,
            go: '/(tabs)/mitra',
        },
        {
            label: 'Verifikasi driver',
            count: data.pendingDrivers,
            tone: 'warn' as const,
            go: '/(tabs)/mitra',
        },
        {
            label: 'Penarikan menunggu',
            count: data.pendingWithdrawals,
            tone: 'info' as const,
            go: '/(tabs)/keuangan',
        },
    ];

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {/* ── Header ── */}
                <View style={s.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.muted}>{greeting()}</Text>
                        <Text style={s.title} numberOfLines={1}>
                            {adminName}
                        </Text>
                    </View>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{initials(adminName)}</Text>
                    </View>
                </View>

                {/* ── Ringkasan ── */}
                <View style={s.statsRow}>
                    <View style={[s.card, s.statCard]}>
                        <Text style={s.muted}>Pesanan hari ini</Text>
                        <Text style={s.statValue}>{data.ordersToday}</Text>
                    </View>
                    <View style={[s.card, s.statCard]}>
                        <Text style={s.muted}>Komisi platform</Text>
                        <Text style={s.statValue} numberOfLines={1}>
                            {rupiahCompact(data.commissionTotal)}
                        </Text>
                        <Text style={[s.muted, { marginTop: 4 }]}>
                            Hari ini {rupiahCompact(data.commissionToday)}
                        </Text>
                    </View>
                </View>
                <View style={s.statsRow}>
                    <View style={[s.card, s.statCard]}>
                        <Text style={s.muted}>Mitra aktif</Text>
                        <Text style={s.statValue}>{data.activePartners}</Text>
                    </View>
                    <View style={[s.card, s.statCard]}>
                        <Text style={s.muted}>Perlu diverifikasi</Text>
                        <Text
                            style={[
                                s.statValue,
                                data.pendingVerification > 0 && { color: COLORS.warnText },
                            ]}
                        >
                            {data.pendingVerification}
                        </Text>
                    </View>
                </View>

                {/* ── Grafik 7 hari ── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>Pesanan 7 hari terakhir</Text>
                    <View style={s.chart}>
                        {data.days.map((d, i) => {
                            const isToday = i === data.days.length - 1;
                            return (
                                <View
                                    key={d.date}
                                    style={s.barCol}
                                    accessible
                                    accessibilityLabel={`${dayShort(d.date)}: ${d.count} pesanan`}
                                >
                                    <View
                                        style={[
                                            s.bar,
                                            {
                                                height: barHeight(d.count),
                                                backgroundColor: isToday ? COLORS.primary : COLORS.barOff,
                                            },
                                        ]}
                                    />
                                    <Text style={s.muted}>{dayShort(d.date)}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ── Perlu tindakan ── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>Perlu tindakan</Text>
                    {actions.map((a) => (
                        <Pressable
                            key={a.label}
                            style={({ pressed }) => [s.actionRow, pressed && { opacity: 0.7 }]}
                            onPress={() => router.push(a.go as any)}
                            accessibilityRole="button"
                        >
                            <Text style={s.actionLabel}>{a.label}</Text>
                            <View style={s.actionRight}>
                                <View
                                    style={[
                                        s.badge,
                                        {
                                            backgroundColor: a.tone === 'warn' ? COLORS.warnBg : COLORS.infoBg,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.badgeText,
                                            { color: a.tone === 'warn' ? COLORS.warnText : COLORS.infoText },
                                        ]}
                                    >
                                        {a.count}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                            </View>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    scroll: { padding: 20, paddingBottom: 32, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    muted: { fontSize: 12, color: COLORS.muted },
    title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: COLORS.ink },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontWeight: '800', color: COLORS.infoText },

    statsRow: { flexDirection: 'row', gap: 12 },
    card: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        padding: 14,
    },
    statValue: { marginTop: 6, fontSize: 24, fontWeight: '800', color: COLORS.ink },

    statCard: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.ink },

    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
    barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
    bar: { width: '100%', borderRadius: 6 },

    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.line,
    },
    actionLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink },
    actionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '800' },

    errorText: { marginVertical: 12, fontSize: 14, color: COLORS.muted, textAlign: 'center' },
    retryBtn: {
        height: 48,
        paddingHorizontal: 28,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});