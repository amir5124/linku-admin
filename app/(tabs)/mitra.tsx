// app/(tabs)/mitra.tsx — Mitra (merchant & driver) admin Waruung
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Badge,
    BottomSheet,
    DetailRows,
    FilterChips,
    ListEmpty,
    Segmented,
    SheetButton,
    SheetButtons,
    SheetError,
    Tone,
} from '../../components/AdminUi';
import { adminCall, COLORS, formatDateTime, initials, usePagedList } from '../../lib/adminKit';

type PartnerType = 'merchant' | 'driver';
type PartnerStatus = 'active' | 'pending' | 'suspended';

type Partner = {
    user_id: string;
    name: string;
    owner_name?: string | null;
    phone?: string | null;
    address?: string | null;
    status: PartnerStatus;
    is_open?: boolean | null;
    rating_avg?: number | null;
    total_orders?: number | null;
    created_at?: string | null;
};

const PAGE_SIZE = 20;

const TYPES = [
    { key: 'merchant', label: 'Merchant' },
    { key: 'driver', label: 'Driver' },
];

const STATUS_BADGE: Record<PartnerStatus, { label: string; tone: Tone }> = {
    active: { label: 'Aktif', tone: 'ok' },
    pending: { label: 'Menunggu', tone: 'warn' },
    suspended: { label: 'Ditangguhkan', tone: 'danger' },
};

type ConfirmAction = 'verify' | 'suspend' | 'activate';

export default function MitraScreen() {
    const [type, setType] = useState<PartnerType>('merchant');
    const [status, setStatus] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const [sel, setSel] = useState<Partner | null>(null);
    const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const list = usePagedList<Partner>(`${type}|${status}|${search}`, (offset) =>
        adminCall('partners', { type, status, search, limit: PAGE_SIZE, offset })
    );
    const counts = list.meta?.counts as
        | { all: number; active: number; pending: number; suspended: number }
        | undefined;

    const closeSheet = () => {
        setSel(null);
        setConfirm(null);
        setActionError(null);
    };

    const changeType = (k: string) => {
        setType(k as PartnerType);
        setStatus('all');
    };

    const runAction = async () => {
        if (!sel || !confirm) return;
        setBusy(true);
        setActionError(null);
        try {
            if (confirm === 'verify') {
                await adminCall(type === 'merchant' ? 'verifyMerchant' : 'verifyDriver', sel.user_id);
            } else {
                await adminCall('suspendPartner', sel.user_id, confirm === 'suspend');
            }
            closeSheet();
            list.silentRefresh();
        } catch (e: any) {
            setActionError(e?.message ?? 'Aksi gagal, coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    const confirmText = (): { label: string; text: string; danger?: boolean } | null => {
        if (!sel || !confirm) return null;
        if (confirm === 'verify') {
            return {
                label: 'Verifikasi',
                text: `Verifikasi ${sel.name}? Mitra akan ditandai terverifikasi.`,
            };
        }
        if (confirm === 'suspend') {
            return {
                label: 'Tangguhkan',
                danger: true,
                text:
                    `Tangguhkan ${sel.name}? Mitra tidak lagi dihitung sebagai mitra aktif.` +
                    (type === 'merchant' ? ' Toko juga ditutup otomatis.' : ''),
            };
        }
        return { label: 'Aktifkan', text: `Aktifkan kembali ${sel.name}?` };
    };

    const meta = (p: Partner) => (type === 'merchant' ? p.address || p.phone : p.phone) || '-';

    const header = (
        <View style={s.headerWrap}>
            <Text style={s.title}>Mitra</Text>
            <Segmented options={TYPES} value={type} onChange={changeType} />

            <View style={s.searchWrap}>
                <Ionicons name="search-outline" size={20} color={COLORS.muted} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Cari nama mitra"
                    placeholderTextColor={COLORS.placeholder}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    autoCorrect={false}
                    returnKeyType="search"
                    accessibilityLabel="Cari mitra"
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

            <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                    { key: 'all', label: 'Semua', count: counts?.all },
                    { key: 'active', label: 'Aktif', count: counts?.active },
                    { key: 'pending', label: 'Menunggu', count: counts?.pending },
                    { key: 'suspended', label: 'Ditangguhkan', count: counts?.suspended },
                ]}
            />
        </View>
    );

    const renderItem = ({ item }: { item: Partner }) => {
        const b = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
        return (
            <Pressable
                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                onPress={() => setSel(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${b.label}`}
            >
                <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                        <Text style={s.name} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Badge tone={b.tone} label={b.label} />
                    </View>
                    <Text style={s.meta} numberOfLines={1}>
                        {meta(item)}
                    </Text>
                </View>
                {item.status === 'pending' ? (
                    <View style={s.reviewBtn}>
                        <Text style={s.reviewText}>Tinjau</Text>
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                )}
            </Pressable>
        );
    };

    const c = confirmText();

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <FlatList
                data={list.items}
                keyExtractor={(p) => p.user_id}
                renderItem={renderItem}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <ListEmpty
                        loading={list.loading}
                        error={list.error}
                        onRetry={list.reload}
                        icon="storefront-outline"
                        title="Tidak ada mitra"
                        text={
                            search
                                ? `Tidak ada mitra dengan nama "${search}".`
                                : 'Belum ada mitra pada filter ini.'
                        }
                    />
                }
                ListFooterComponent={
                    list.loadingMore ? (
                        <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} />
                    ) : null
                }
                contentContainerStyle={s.list}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onEndReached={list.loadMore}
                onEndReachedThreshold={0.4}
                refreshControl={
                    <RefreshControl
                        refreshing={list.refreshing}
                        onRefresh={list.refresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            />

            {/* ── Detail & aksi mitra ── */}
            <BottomSheet visible={!!sel} onClose={closeSheet} title={sel?.name}>
                {sel && !confirm && (
                    <>
                        <View style={s.sheetBadge}>
                            <Badge
                                tone={STATUS_BADGE[sel.status].tone}
                                label={STATUS_BADGE[sel.status].label}
                            />
                        </View>
                        <DetailRows
                            rows={[
                                ['Pemilik', type === 'merchant' ? sel.owner_name : null],
                                ['Telepon', sel.phone],
                                ['Alamat', sel.address],
                                [
                                    'Status toko',
                                    type === 'merchant' && sel.is_open != null
                                        ? sel.is_open
                                            ? 'Buka'
                                            : 'Tutup'
                                        : null,
                                ],
                                ['Rating', sel.rating_avg != null ? Number(sel.rating_avg).toFixed(1) : null],
                                ['Total pesanan', sel.total_orders],
                                ['Terdaftar', formatDateTime(sel.created_at)],
                            ]}
                        />
                        {sel.status === 'pending' && (
                            <SheetButton label="Verifikasi" onPress={() => setConfirm('verify')} />
                        )}
                        {sel.status === 'active' && (
                            <SheetButton
                                label="Tangguhkan"
                                tone="danger"
                                onPress={() => setConfirm('suspend')}
                            />
                        )}
                        {sel.status === 'suspended' && (
                            <SheetButton label="Aktifkan" onPress={() => setConfirm('activate')} />
                        )}
                    </>
                )}

                {sel && confirm && c && (
                    <>
                        <Text style={s.confirmText}>{c.text}</Text>
                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel={c.label}
                            danger={c.danger}
                            busy={busy}
                            onConfirm={runAction}
                            onCancel={() => {
                                setConfirm(null);
                                setActionError(null);
                            }}
                        />
                    </>
                )}
            </BottomSheet>
        </SafeAreaView>
    );
}

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
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontWeight: '800', color: COLORS.infoFg },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: COLORS.ink },
    meta: { marginTop: 4, fontSize: 12, color: COLORS.muted },
    reviewBtn: {
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

    sheetBadge: { flexDirection: 'row', marginBottom: 4 },
    confirmText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
});