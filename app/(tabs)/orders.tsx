// app/(tabs)/orders.tsx — Pesanan (admin Waruung)
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

const COLORS = {
    primary: '#1477b8',
    ink: '#12222f',
    muted: '#5b6b7b',
    placeholder: '#7b8794',
    border: '#cfd9e3',
    line: '#e1e8ef',
    surface: '#f4f7fa',
    white: '#ffffff',
};

// ============================================================
// DATA
// ============================================================
type OrderStatus = 'diproses' | 'diantar' | 'selesai' | 'batal' | 'lainnya';

type AdminOrder = {
    id: string | number;
    order_code: string;
    service: string;
    status: OrderStatus;
    raw_status?: string;
    total: number;
    settlement_type?: string | null;
    merchant_name?: string | null;
    driver_name?: string | null;
    customer_name?: string | null;
    dropoff_name?: string | null;
    created_at?: string | null;
};

const PAGE_SIZE = 20;
const num = (v: any) => Number(v) || 0;

async function fetchOrders(params: {
    status: string;
    search: string;
    limit: number;
    offset: number;
}): Promise<{ items: AdminOrder[]; total: number }> {
    const fn = (api as any).admin?.orders;
    if (typeof fn !== 'function') {
        throw new Error('Endpoint pesanan admin belum tersedia. Tambahkan api.admin.orders().');
    }
    const raw = await fn(params);
    const d = raw?.data ?? raw ?? {};
    return {
        items: Array.isArray(d.items) ? d.items : [],
        total: num(d.total),
    };
}

// ============================================================
// FILTER & TAMPILAN
// ============================================================
const FILTERS: { key: string; label: string }[] = [
    { key: 'semua', label: 'Semua' },
    { key: 'diproses', label: 'Diproses' },
    { key: 'diantar', label: 'Diantar' },
    { key: 'selesai', label: 'Selesai' },
    { key: 'batal', label: 'Batal' },
];

const STATUS_STYLE: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
    diproses: { label: 'Diproses', bg: '#fdf1e2', fg: '#8a4a06' },
    diantar: { label: 'Diantar', bg: '#e6f2fb', fg: '#0f5c91' },
    selesai: { label: 'Selesai', bg: '#e3f6ec', fg: '#12683f' },
    batal: { label: 'Batal', bg: '#fdeaea', fg: '#b42318' },
    lainnya: { label: 'Lainnya', bg: '#e6edf3', fg: '#5b6b7b' },
};

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatDateTime = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const counterparty = (o: AdminOrder) => o.merchant_name || o.driver_name || o.customer_name || '-';

const payLabel = (s?: string | null) => {
    if (!s) return '-';
    return /cash|tunai/i.test(s) ? 'Tunai' : 'Online';
};

// ============================================================
// SCREEN
// ============================================================
export default function OrdersScreen() {
    const [status, setStatus] = useState('semua');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const [items, setItems] = useState<AdminOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selected, setSelected] = useState<AdminOrder | null>(null);

    // Tunda pencarian 400 ms supaya tidak memanggil API di setiap ketikan
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Abaikan respons lama kalau filter sudah berganti
    const reqId = useRef(0);

    const load = useCallback(
        async (mode: 'initial' | 'refresh' | 'more', offset = 0) => {
            const id = ++reqId.current;
            if (mode === 'initial') setLoading(true);
            if (mode === 'more') setLoadingMore(true);
            try {
                setError(null);
                const res = await fetchOrders({ status, search, limit: PAGE_SIZE, offset });
                if (id !== reqId.current) return;
                setTotal(res.total);
                setItems((prev) => {
                    if (mode !== 'more') return res.items;
                    const seen = new Set(prev.map((x) => String(x.id)));
                    return [...prev, ...res.items.filter((x) => !seen.has(String(x.id)))];
                });
            } catch (e: any) {
                if (id !== reqId.current) return;
                console.warn('[PESANAN ADMIN] Gagal:', e?.message);
                setError(e?.message ?? 'Gagal memuat pesanan');
            } finally {
                if (id === reqId.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [status, search]
    );

    // Muat ulang saat filter / pencarian berubah
    useEffect(() => {
        load('initial');
    }, [load]);

    // Segarkan diam-diam saat tab kembali aktif (tidak untuk fokus pertama)
    const loadRef = useRef(load);
    loadRef.current = load;
    const focusedOnce = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (focusedOnce.current) loadRef.current('refresh');
            focusedOnce.current = true;
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        load('refresh');
    };

    const hasMore = items.length < total;
    const onEndReached = () => {
        if (hasMore && !loading && !loadingMore && !error) load('more', items.length);
    };

    // ── Bagian atas daftar ──
    const header = (
        <View style={s.headerWrap}>
            <Text style={s.title}>Pesanan</Text>

            <View style={s.searchWrap}>
                <Ionicons name="search-outline" size={20} color={COLORS.muted} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Cari kode pesanan"
                    placeholderTextColor={COLORS.placeholder}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="search"
                    accessibilityLabel="Cari pesanan"
                />
                {searchInput.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setSearchInput('')}
                        hitSlop={10}
                        accessibilityLabel="Hapus pencarian"
                    >
                        <Ionicons name="close-circle" size={20} color={COLORS.muted} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
                keyboardShouldPersistTaps="handled"
            >
                {FILTERS.map((f) => {
                    const active = status === f.key;
                    return (
                        <Pressable
                            key={f.key}
                            style={[s.chip, active && s.chipActive]}
                            onPress={() => setStatus(f.key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                        >
                            <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {!loading && !error && items.length > 0 && (
                <Text style={s.count}>{total} pesanan</Text>
            )}
        </View>
    );

    // ── Kartu pesanan ──
    const renderItem = ({ item }: { item: AdminOrder }) => {
        const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.lainnya;
        return (
            <Pressable
                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`Pesanan ${item.order_code}, ${st.label}`}
            >
                <View style={{ flex: 1 }}>
                    <View style={s.codeRow}>
                        <Text style={s.code}>#{item.order_code}</Text>
                        <View style={[s.badge, { backgroundColor: st.bg }]}>
                            <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                    </View>
                    <Text style={s.sub} numberOfLines={1}>
                        {item.service} · {counterparty(item)}
                    </Text>
                </View>
                <Text style={s.total}>{rupiah(item.total)}</Text>
            </Pressable>
        );
    };

    const empty = loading ? (
        <View style={s.stateWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    ) : error ? (
        <View style={s.stateWrap}>
            <Ionicons name="cloud-offline-outline" size={44} color={COLORS.muted} />
            <Text style={s.stateText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => load('initial')}>
                <Text style={s.retryText}>Coba Lagi</Text>
            </TouchableOpacity>
        </View>
    ) : (
        <View style={s.stateWrap}>
            <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.muted} />
            </View>
            <Text style={s.stateTitle}>Tidak ada pesanan</Text>
            <Text style={s.stateText}>
                {search
                    ? `Tidak ada pesanan dengan kode "${search}".`
                    : 'Belum ada pesanan pada filter ini.'}
            </Text>
        </View>
    );

    const sel = selected;
    const selStyle = sel ? (STATUS_STYLE[sel.status] ?? STATUS_STYLE.lainnya) : STATUS_STYLE.lainnya;

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <FlatList
                data={items}
                keyExtractor={(o) => String(o.id)}
                renderItem={renderItem}
                ListHeaderComponent={header}
                ListEmptyComponent={empty}
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} />
                    ) : null
                }
                contentContainerStyle={s.list}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            />

            {/* ── Detail pesanan ── */}
            <Modal
                visible={!!sel}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setSelected(null)}
            >
                <View style={s.sheetOverlay}>
                    <TouchableWithoutFeedback onPress={() => setSelected(null)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    {sel && (
                        <View style={s.sheet}>
                            <TouchableOpacity
                                style={s.sheetClose}
                                onPress={() => setSelected(null)}
                                accessibilityLabel="Tutup"
                            >
                                <Ionicons name="close" size={24} color="#1c1c1c" />
                            </TouchableOpacity>

                            <View style={s.codeRow}>
                                <Text style={s.sheetTitle}>#{sel.order_code}</Text>
                                <View style={[s.badge, { backgroundColor: selStyle.bg }]}>
                                    <Text style={[s.badgeText, { color: selStyle.fg }]}>
                                        {selStyle.label}
                                    </Text>
                                </View>
                            </View>

                            {(
                                [
                                    ['Layanan', sel.service],
                                    ['Pelanggan', sel.customer_name],
                                    ['Merchant', sel.merchant_name],
                                    ['Driver', sel.driver_name],
                                    ['Tujuan', sel.dropoff_name],
                                    ['Pembayaran', payLabel(sel.settlement_type)],
                                    ['Dibuat', formatDateTime(sel.created_at)],
                                ] as [string, string | null | undefined][]
                            )
                                .filter(([, v]) => !!v && v !== '-')
                                .map(([k, v]) => (
                                    <View key={k} style={s.detailRow}>
                                        <Text style={s.detailKey}>{k}</Text>
                                        <Text style={s.detailVal}>{v}</Text>
                                    </View>
                                ))}

                            <View style={[s.detailRow, s.totalRow]}>
                                <Text style={s.detailKey}>Total</Text>
                                <Text style={s.sheetTotal}>{rupiah(sel.total)}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },

    headerWrap: { gap: 14, paddingTop: 12, paddingBottom: 14 },
    title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: COLORS.ink },

    searchWrap: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    searchInput: { flex: 1, fontSize: 15, color: COLORS.ink, paddingVertical: 0 },

    chips: { gap: 8, paddingRight: 8 },
    chip: {
        minHeight: 38,
        paddingHorizontal: 14,
        justifyContent: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
    chipTextActive: { color: COLORS.white },
    count: { fontSize: 12, color: COLORS.muted },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        padding: 14,
    },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    code: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    sub: { marginTop: 6, fontSize: 12, color: COLORS.muted },
    total: { fontSize: 15, fontWeight: '800', color: COLORS.ink },

    // Kosong / error / loading
    stateWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    stateTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
    stateText: { marginTop: 8, fontSize: 13, lineHeight: 20, color: COLORS.muted, textAlign: 'center' },
    retryBtn: {
        marginTop: 16,
        height: 48,
        paddingHorizontal: 28,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

    // Detail (bottom sheet)
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 40,
        position: 'relative',
    },
    sheetClose: {
        position: 'absolute',
        right: 24,
        top: -64,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    sheetTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.line,
    },
    detailKey: { fontSize: 13, color: COLORS.muted },
    detailVal: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: COLORS.ink },
    totalRow: { borderBottomWidth: 0, alignItems: 'center' },
    sheetTotal: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
});