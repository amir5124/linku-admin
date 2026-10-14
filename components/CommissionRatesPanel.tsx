// components/CommissionRatesPanel.tsx
// Kelola tarif komisi (tabel commission_rates).
// Urutan pemilihan komisi di backend (fungsi get_commission_rate):
//   1) komisi khusus kode tarif  →  2) default jenis order  →  3) bawaan 8%
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { adminCall, COLORS, num } from '../lib/adminKit';
import {
    Badge,
    BottomSheet,
    Field,
    FilterChips,
    SheetButton,
    SheetButtons,
    SheetError,
    SwitchRow,
} from './AdminUi';

type Rate = {
    order_type: string;
    tariff_code: string | null;
    rate: number | string;
    is_active: boolean;
};

type TariffLite = { code: string; label: string };

const ORDER_TYPES: { key: string; label: string }[] = [
    { key: 'ride', label: 'Ride (URide/UCar)' },
    { key: 'send', label: 'Send (USend)' },
    { key: 'food', label: 'Food (UFood)' },
];

const FALLBACK_RATE = 0.08;
const DEFAULT_KEY = '_default';

const typeLabel = (t: string) => ORDER_TYPES.find((o) => o.key === t)?.label ?? t;
const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;

/** Meniru fungsi SQL get_commission_rate */
function effectiveRate(rates: Rate[], orderType: string, tariffCode: string | null) {
    const active = rates.filter((r) => r.is_active && r.order_type === orderType);
    const specific = tariffCode ? active.find((r) => r.tariff_code === tariffCode) : undefined;
    if (specific) return { rate: num(specific.rate), source: 'Komisi khusus tarif ini' };
    const def = active.find((r) => r.tariff_code == null);
    if (def) return { rate: num(def.rate), source: 'Default jenis order' };
    return { rate: FALLBACK_RATE, source: 'Bawaan sistem (tidak ada komisi aktif)' };
}

type Form = {
    mode: 'create' | 'edit';
    order_type: string;
    tariff_code: string | null;
    ratePct: string;
    is_active: boolean;
};

export default function CommissionRatesPanel({
    tariffs,
    addTick,
    refreshTick,
}: {
    tariffs: TariffLite[];
    /** naik setiap kali tombol "Tambah" di header ditekan */
    addTick: number;
    /** naik setiap kali halaman ditarik untuk refresh */
    refreshTick: number;
}) {
    const [rates, setRates] = useState<Rate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<Form | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Uji "komisi yang berlaku"
    const [testType, setTestType] = useState('ride');
    const [testTariff, setTestTariff] = useState(DEFAULT_KEY);

    const load = useCallback(async () => {
        try {
            setError(null);
            const d = await adminCall<Rate[]>('commissionRates');
            setRates(Array.isArray(d) ? d : []);
        } catch (e: any) {
            console.warn('[KOMISI] Gagal:', e?.message);
            setError(e?.message ?? 'Gagal memuat komisi');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    // Refresh dari tarikan layar induk (lewati nilai awal)
    const firstRefresh = useRef(true);
    useEffect(() => {
        if (firstRefresh.current) {
            firstRefresh.current = false;
            return;
        }
        load();
    }, [refreshTick, load]);

    // Tombol "Tambah" di header
    const firstAdd = useRef(true);
    useEffect(() => {
        if (firstAdd.current) {
            firstAdd.current = false;
            return;
        }
        setActionError(null);
        setConfirmDelete(false);
        setForm({ mode: 'create', order_type: 'ride', tariff_code: null, ratePct: '', is_active: true });
    }, [addTick]);

    const grouped = useMemo(() => {
        return ORDER_TYPES.map((t) => ({
            ...t,
            items: rates
                .filter((r) => r.order_type === t.key)
                // default dulu, lalu per kode tarif
                .sort((a, b) => (a.tariff_code == null ? -1 : b.tariff_code == null ? 1 : a.tariff_code.localeCompare(b.tariff_code))),
        })).filter((g) => g.items.length > 0);
    }, [rates]);

    const tariffLabel = (code: string | null) =>
        code == null ? 'Default (semua tarif)' : `${tariffs.find((t) => t.code === code)?.label ?? code} · ${code}`;

    const test = effectiveRate(rates, testType, testTariff === DEFAULT_KEY ? null : testTariff);

    // ── Aksi ──
    const close = () => {
        setForm(null);
        setConfirmDelete(false);
        setActionError(null);
    };

    const save = async () => {
        if (!form) return;
        const p = Number(form.ratePct.replace(',', '.'));
        if (form.ratePct.trim() === '' || !Number.isFinite(p) || p < 0 || p > 100) {
            return setActionError('Komisi harus berupa angka antara 0 dan 100 (persen).');
        }
        const rate = Math.round(p * 100) / 10000; // 15 → 0.15 (hindari galat desimal)

        setBusy(true);
        setActionError(null);
        try {
            if (form.mode === 'create') {
                await adminCall('createCommissionRate', {
                    order_type: form.order_type,
                    tariff_code: form.tariff_code,
                    rate,
                    is_active: form.is_active,
                });
            } else {
                await adminCall('updateCommissionRate', form.order_type, form.tariff_code, {
                    rate,
                    is_active: form.is_active,
                });
            }
            close();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menyimpan komisi.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!form) return;
        setBusy(true);
        setActionError(null);
        try {
            await adminCall('deleteCommissionRate', form.order_type, form.tariff_code);
            close();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menghapus komisi.');
            setConfirmDelete(false);
        } finally {
            setBusy(false);
        }
    };

    const isDefaultRow = form?.tariff_code == null;
    const pctNum = form ? Number(form.ratePct.replace(',', '.')) : NaN;

    // ── Render ──
    if (loading) return <ActivityIndicator style={{ marginTop: 48 }} size="large" color={COLORS.primary} />;

    if (error) {
        return (
            <View style={s.state}>
                <Ionicons name="cloud-offline-outline" size={44} color={COLORS.muted} />
                <Text style={s.stateText}>{error}</Text>
                <TouchableOpacity
                    style={s.retry}
                    onPress={() => {
                        setLoading(true);
                        load();
                    }}
                >
                    <Text style={s.retryText}>Coba Lagi</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ gap: 14 }}>
            <Text style={s.note}>
                Komisi dipilih berurutan: komisi khusus kode tarif, lalu default jenis order, lalu bawaan sistem{' '}
                {pct(FALLBACK_RATE)}. Perubahan berlaku untuk pesanan yang diselesaikan setelahnya.
            </Text>

            {/* ── Uji komisi yang berlaku ── */}
            <View style={s.testCard}>
                <Text style={s.testTitle}>Cek komisi yang berlaku</Text>
                <FilterChips options={ORDER_TYPES} value={testType} onChange={setTestType} />
                <View style={{ height: 8 }} />
                <FilterChips
                    options={[{ key: DEFAULT_KEY, label: 'Tanpa kode tarif' }, ...tariffs.map((t) => ({ key: t.code, label: t.label || t.code }))]}
                    value={testTariff}
                    onChange={setTestTariff}
                />
                <View style={s.testResultRow}>
                    <Text style={s.testRate}>{pct(test.rate)}</Text>
                    <Text style={s.testSource}>{test.source}</Text>
                </View>
            </View>

            {/* ── Daftar ── */}
            {grouped.length === 0 ? (
                <Text style={s.empty}>
                    Belum ada komisi di tabel. Semua pesanan memakai komisi bawaan {pct(FALLBACK_RATE)}. Ketuk Tambah untuk
                    membuat komisi default per jenis order.
                </Text>
            ) : (
                grouped.map((g) => (
                    <View key={g.key} style={{ gap: 10 }}>
                        <Text style={s.groupLabel}>{g.label}</Text>
                        {g.items.map((r) => (
                            <Pressable
                                key={`${r.order_type}|${r.tariff_code ?? ''}`}
                                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                                onPress={() => {
                                    setActionError(null);
                                    setConfirmDelete(false);
                                    setForm({
                                        mode: 'edit',
                                        order_type: r.order_type,
                                        tariff_code: r.tariff_code,
                                        ratePct: String(+(num(r.rate) * 100).toFixed(2)),
                                        is_active: r.is_active !== false,
                                    });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Komisi ${g.label} ${tariffLabel(r.tariff_code)}`}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={s.cardTitle} numberOfLines={1}>
                                        {tariffLabel(r.tariff_code)}
                                    </Text>
                                    <Text style={s.cardRate}>{pct(num(r.rate))}</Text>
                                </View>
                                <Badge tone={r.is_active ? 'ok' : 'neutral'} label={r.is_active ? 'Aktif' : 'Nonaktif'} />
                                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                            </Pressable>
                        ))}
                    </View>
                ))
            )}

            {/* ── Sheet: buat / ubah ── */}
            <BottomSheet
                visible={!!form}
                onClose={close}
                title={form?.mode === 'create' ? 'Komisi baru' : 'Ubah komisi'}
            >
                {form && !confirmDelete && (
                    <>
                        {form.mode === 'create' ? (
                            <>
                                <View style={s.block}>
                                    <Text style={s.label}>Jenis order</Text>
                                    <FilterChips
                                        options={ORDER_TYPES}
                                        value={form.order_type}
                                        onChange={(k) => setForm({ ...form, order_type: k })}
                                    />
                                </View>
                                <View style={s.block}>
                                    <Text style={s.label}>Berlaku untuk</Text>
                                    <FilterChips
                                        options={[
                                            { key: DEFAULT_KEY, label: 'Default (semua tarif)' },
                                            ...tariffs.map((t) => ({ key: t.code, label: t.label || t.code })),
                                        ]}
                                        value={form.tariff_code ?? DEFAULT_KEY}
                                        onChange={(k) => setForm({ ...form, tariff_code: k === DEFAULT_KEY ? null : k })}
                                    />
                                    <Text style={s.hint}>
                                        Komisi khusus tarif mengalahkan default jenis order.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={s.block}>
                                <Text style={s.label}>Berlaku untuk</Text>
                                <Text style={s.fixedValue}>
                                    {typeLabel(form.order_type)} · {tariffLabel(form.tariff_code)}
                                </Text>
                                <Text style={s.hint}>Jenis order dan kode tarif tidak bisa diubah. Hapus lalu buat baru bila perlu.</Text>
                            </View>
                        )}

                        <Field
                            label="Komisi (%)"
                            value={form.ratePct}
                            onChangeText={(v) => setForm({ ...form, ratePct: v })}
                            keyboardType="decimal-pad"
                            placeholder="mis. 15"
                            hint={
                                form.ratePct.trim() !== '' && Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100
                                    ? `Disimpan sebagai ${+(pctNum / 100).toFixed(4)}`
                                    : 'Isi 0 sampai 100. Contoh: 15 berarti 15%.'
                            }
                        />
                        <SwitchRow
                            label="Komisi aktif"
                            value={form.is_active}
                            onChange={(v) => setForm({ ...form, is_active: v })}
                        />
                        {form.mode === 'edit' && isDefaultRow && !form.is_active && (
                            <Text style={s.warn}>
                                Tanpa komisi default yang aktif, tarif yang tidak punya komisi khusus memakai bawaan sistem{' '}
                                {pct(FALLBACK_RATE)}.
                            </Text>
                        )}

                        <SheetError message={actionError} />
                        <SheetButtons confirmLabel="Simpan" busy={busy} onConfirm={save} onCancel={close} />
                        {form.mode === 'edit' && (
                            <SheetButton
                                label="Hapus komisi"
                                tone="danger"
                                onPress={() => {
                                    setActionError(null);
                                    setConfirmDelete(true);
                                }}
                            />
                        )}
                    </>
                )}

                {form && confirmDelete && (
                    <>
                        <Text style={s.confirmText}>
                            Hapus komisi {typeLabel(form.order_type)} · {tariffLabel(form.tariff_code)}?
                            {isDefaultRow
                                ? ` Tanpa default, pesanan jenis ini memakai komisi bawaan sistem ${pct(FALLBACK_RATE)}.`
                                : ' Tarif ini akan memakai komisi default jenis order.'}
                        </Text>
                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel="Hapus"
                            danger
                            busy={busy}
                            onConfirm={remove}
                            onCancel={() => setConfirmDelete(false)}
                        />
                    </>
                )}
            </BottomSheet>
        </View>
    );
}

const s = StyleSheet.create({
    note: { fontSize: 12, lineHeight: 18, color: COLORS.muted },

    testCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        padding: 14,
        gap: 10,
    },
    testTitle: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
    testResultRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
    testRate: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
    testSource: { flex: 1, fontSize: 12, color: COLORS.muted },

    groupLabel: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        padding: 14,
    },
    cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
    cardRate: { marginTop: 4, fontSize: 20, fontWeight: '800', color: COLORS.primary },

    empty: { marginTop: 24, textAlign: 'center', fontSize: 13, lineHeight: 20, color: COLORS.muted },
    state: { alignItems: 'center', paddingVertical: 40 },
    stateText: { marginTop: 10, fontSize: 13, lineHeight: 20, color: COLORS.muted, textAlign: 'center' },
    retry: {
        marginTop: 16,
        height: 48,
        paddingHorizontal: 28,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

    block: { marginTop: 14 },
    label: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
    hint: { marginTop: 6, fontSize: 12, color: COLORS.muted },
    fixedValue: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
    warn: { marginTop: 4, fontSize: 12, lineHeight: 18, color: COLORS.warnFg },
    confirmText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
});