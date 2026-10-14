// app/(tabs)/keuangan.tsx — Keuangan admin Waruung
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
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
    SheetButtons,
    SheetError,
    Tone,
} from '../../components/AdminUi';
import { adminCall, COLORS, formatDateTime, num, rupiah, usePagedList } from '../../lib/adminKit';

type Tab = 'penarikan' | 'topup' | 'komisi';

type TxItem = {
    id: string | number;
    source?: 'linkqu' | 'payout';
    user_id: string;
    name: string;
    role?: string | null;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'success' | 'failed';
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
    cash_debt?: number;
    created_at?: string | null;
};

type CommissionItem = {
    id: string | number;
    order_code: string;
    service: string;
    settlement_type?: string | null;
    commission: number;
    completed_at?: string | null;
};

const PAGE_SIZE = 20;

const TABS = [
    { key: 'penarikan', label: 'Penarikan' },
    { key: 'topup', label: 'Top up' },
    { key: 'komisi', label: 'Komisi' },
];

// Menunggu / Berhasil / Gagal = penarikan otomatis via LinkQu (dipantau saja).
// Pengajuan = permintaan payout manual driver yang perlu disetujui admin.
const WD_FILTERS = [
    { key: 'pending', label: 'Menunggu' },
    { key: 'success', label: 'Berhasil' },
    { key: 'failed', label: 'Gagal' },
    { key: 'payout', label: 'Pengajuan' },
];

const TX_BADGE: Record<TxItem['status'], { label: string; tone: Tone }> = {
    pending: { label: 'Menunggu', tone: 'warn' },
    approved: { label: 'Disetujui', tone: 'info' },
    rejected: { label: 'Ditolak', tone: 'danger' },
    success: { label: 'Berhasil', tone: 'ok' },
    failed: { label: 'Gagal', tone: 'danger' },
};

const roleLabel = (r?: string | null) =>
    r === 'merchant' ? 'Merchant' : r === 'driver' ? 'Driver' : 'Pengguna';

const payLabel = (s?: string | null) => (!s ? null : /cash|tunai/i.test(s) ? 'Tunai' : 'Online');

export default function KeuanganScreen() {
    const [tab, setTab] = useState<Tab>('penarikan');
    const [wdStatus, setWdStatus] = useState('pending');

    // Ringkasan penarikan menunggu
    const [summary, setSummary] = useState<{ count: number; total: number } | null>(null);
    const loadSummary = useCallback(async () => {
        try {
            const d = await adminCall('financeSummary');
            setSummary({
                count: num(d?.pending_withdrawals?.count),
                total: num(d?.pending_withdrawals?.total),
            });
        } catch (e: any) {
            console.warn('[KEUANGAN] Ringkasan gagal:', e?.message);
        }
    }, []);
    useFocusEffect(
        useCallback(() => {
            loadSummary();
        }, [loadSummary])
    );

    const list = usePagedList<any>(`${tab}|${wdStatus}`, (offset) => {
        const base = { limit: PAGE_SIZE, offset };
        if (tab === 'penarikan') {
            return wdStatus === 'payout'
                ? adminCall('withdrawals', { ...base, source: 'payout', status: 'pending' })
                : adminCall('withdrawals', { ...base, source: 'linkqu', status: wdStatus });
        }
        if (tab === 'topup') return adminCall('topups', base);
        return adminCall('commissions', base);
    });

    // Aksi setuju / tolak
    const [wd, setWd] = useState<{ item: TxItem; mode: 'approve' | 'reject' } | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const closeSheet = () => {
        setWd(null);
        setReason('');
        setActionError(null);
    };

    const runAction = async () => {
        if (!wd) return;
        setBusy(true);
        setActionError(null);
        try {
            if (wd.mode === 'approve') {
                await adminCall('approvePayout', wd.item.id);
            } else {
                await adminCall('rejectPayout', wd.item.id, reason.trim() || undefined);
            }
            closeSheet();
            list.silentRefresh();
            loadSummary();
        } catch (e: any) {
            setActionError(e?.message ?? 'Aksi gagal, coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    const onRefresh = () => {
        list.refresh();
        loadSummary();
    };

    // ── Bagian atas daftar ──
    const header = (
        <View style={s.headerWrap}>
            <Text style={s.title}>Keuangan</Text>

            <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Penarikan menunggu</Text>
                <Text style={s.summaryAmount}>{summary ? rupiah(summary.total) : '-'}</Text>
                <Text style={s.summarySub}>{summary ? `${summary.count} permintaan` : ' '}</Text>
            </View>

            <Segmented options={TABS} value={tab} onChange={(k) => setTab(k as Tab)} />

            {tab === 'penarikan' && (
                <FilterChips options={WD_FILTERS} value={wdStatus} onChange={setWdStatus} />
            )}
        </View>
    );

    // ── Item ──
    const renderWithdrawal = (item: TxItem) => {
        const pending = item.status === 'pending' && item.source === 'payout';
        const hasDebt = (item.cash_debt ?? 0) > 0;
        const b = TX_BADGE[item.status];
        return (
            <View style={s.card}>
                <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                        <View style={s.nameRow}>
                            <Text style={s.name} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {hasDebt && pending && <Badge tone="danger" label="Ada utang komisi" />}
                            {!pending && <Badge tone={b.tone} label={b.label} />}
                        </View>
                        <Text style={s.meta}>
                            {roleLabel(item.role)}
                            {item.bank_name ? ` · ${item.bank_name}` : ''}
                        </Text>
                    </View>
                    <Text style={s.amount}>{rupiah(item.amount)}</Text>
                </View>

                {pending && (
                    <View style={s.btnRow}>
                        <TouchableOpacity
                            style={[s.smallBtn, s.smallGhost]}
                            onPress={() => setWd({ item, mode: 'reject' })}
                            accessibilityLabel={`Tolak penarikan ${item.name}`}
                        >
                            <Text style={s.smallGhostText}>Tolak</Text>
                        </TouchableOpacity>
                        {!hasDebt && (
                            <TouchableOpacity
                                style={[s.smallBtn, s.smallPrimary]}
                                onPress={() => setWd({ item, mode: 'approve' })}
                                accessibilityLabel={`Setujui penarikan ${item.name}`}
                            >
                                <Text style={s.smallPrimaryText}>Setujui</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderTopup = (item: TxItem) => {
        const b = TX_BADGE[item.status];
        return (
            <View style={[s.card, s.cardTop]}>
                <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                        <Text style={s.name} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Badge tone={b.tone} label={b.label} />
                    </View>
                    <Text style={s.meta}>
                        {roleLabel(item.role)}
                        {item.created_at ? ` · ${formatDateTime(item.created_at)}` : ''}
                    </Text>
                </View>
                <Text style={[s.amount, { color: COLORS.primary }]}>+{rupiah(item.amount)}</Text>
            </View>
        );
    };

    const renderCommission = (item: CommissionItem) => {
        const pay = payLabel(item.settlement_type);
        return (
            <View style={[s.card, s.cardTop]}>
                <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                        <Text style={s.name}>#{item.order_code}</Text>
                        {pay && <Badge tone={pay === 'Tunai' ? 'warn' : 'info'} label={pay.toUpperCase()} />}
                    </View>
                    <Text style={s.meta}>
                        {item.service}
                        {item.completed_at ? ` · ${formatDateTime(item.completed_at)}` : ''}
                    </Text>
                </View>
                <Text style={[s.amount, { color: COLORS.primary }]}>+{rupiah(item.commission)}</Text>
            </View>
        );
    };

    const emptyText =
        tab === 'penarikan'
            ? wdStatus === 'payout'
                ? 'Tidak ada pengajuan payout yang menunggu persetujuan.'
                : 'Belum ada penarikan pada filter ini.'
            : tab === 'topup'
                ? 'Belum ada transaksi top up.'
                : 'Belum ada komisi dari pesanan yang selesai.';

    const sel = wd?.item;

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <FlatList
                data={list.items}
                keyExtractor={(x: any) => String(x.id)}
                renderItem={({ item }) =>
                    tab === 'penarikan'
                        ? renderWithdrawal(item)
                        : tab === 'topup'
                            ? renderTopup(item)
                            : renderCommission(item)
                }
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <ListEmpty
                        loading={list.loading}
                        error={list.error}
                        onRetry={list.reload}
                        icon="wallet-outline"
                        title="Belum ada data"
                        text={emptyText}
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
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            />

            {/* ── Setuju / tolak penarikan ── */}
            <BottomSheet
                visible={!!wd}
                onClose={closeSheet}
                title={wd?.mode === 'approve' ? 'Setujui pengajuan' : 'Tolak pengajuan'}
            >
                {sel && wd && (
                    <>
                        <DetailRows
                            rows={[
                                ['Nama', sel.name],
                                ['Peran', roleLabel(sel.role)],
                                ['Bank', sel.bank_name],
                                ['No. rekening', sel.account_number],
                                ['Atas nama', sel.account_name],
                                ['Diajukan', formatDateTime(sel.created_at)],
                                ['Jumlah', rupiah(sel.amount)],
                            ]}
                        />

                        {wd.mode === 'approve' ? (
                            <Text style={s.confirmText}>
                                Setujui pengajuan {rupiah(sel.amount)} untuk {sel.name}? Status pengajuan
                                akan diubah menjadi disetujui. Pastikan transfer ke rekening di atas
                                sudah atau akan Anda lakukan.
                            </Text>
                        ) : (
                            <>
                                <Text style={s.confirmText}>
                                    Tolak pengajuan {rupiah(sel.amount)} untuk {sel.name}? Dana akan dikembalikan ke saldo driver.
                                </Text>
                                <TextInput
                                    style={s.reasonInput}
                                    placeholder="Alasan (opsional)"
                                    placeholderTextColor={COLORS.placeholder}
                                    value={reason}
                                    onChangeText={setReason}
                                    multiline
                                    editable={!busy}
                                    accessibilityLabel="Alasan penolakan"
                                />
                            </>
                        )}

                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel={wd.mode === 'approve' ? 'Setujui' : 'Tolak'}
                            danger={wd.mode === 'reject'}
                            busy={busy}
                            onConfirm={runAction}
                            onCancel={closeSheet}
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

    summaryCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 18 },
    summaryLabel: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
    summaryAmount: { marginTop: 6, fontSize: 30, fontWeight: '800', color: '#ffffff' },
    summarySub: { marginTop: 4, fontSize: 12, color: '#ffffff' },

    card: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        padding: 14,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    name: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: COLORS.ink },
    meta: { marginTop: 4, fontSize: 12, color: COLORS.muted },
    amount: { fontSize: 15, fontWeight: '800', color: COLORS.ink },

    btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    smallBtn: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    smallGhost: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white },
    smallGhostText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
    smallPrimary: { backgroundColor: COLORS.primary },
    smallPrimaryText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },

    confirmText: { marginTop: 16, fontSize: 15, lineHeight: 22, color: COLORS.ink },
    reasonInput: {
        marginTop: 12,
        minHeight: 72,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 14,
        padding: 14,
        fontSize: 15,
        color: COLORS.ink,
        textAlignVertical: 'top',
    },
});