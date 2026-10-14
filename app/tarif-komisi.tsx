// app/tarif-komisi.tsx — Kelola tarif & pengaturan komisi (admin Waruung)
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Badge,
    BottomSheet,
    FilterChips,
    Segmented,
    SheetButton,
    SheetButtons,
    SheetError,
} from '../components/AdminUi';
import CommissionRatesPanel from '../components/CommissionRatesPanel';
import { adminCall, COLORS, num, rupiah } from '../lib/adminKit';

// ============================================================
// TIPE
// ============================================================
type Tariff = {
    code: string;
    label: string;
    min_fare: number;
    per_km: number;
    base_km: number;
    capacity?: number | null;
    eta_min?: number | null;
    desc_text?: string | null;
    is_active: boolean;
    sort_order?: number | null;
};

type ValueType = 'number' | 'boolean' | 'string' | 'json';

type Setting = {
    key: string;
    value: string;
    value_type: ValueType;
    category?: string | null;
    is_public?: boolean | null;
};

const VALUE_TYPES: { key: string; label: string }[] = [
    { key: 'number', label: 'Angka' },
    { key: 'boolean', label: 'Ya/Tidak' },
    { key: 'string', label: 'Teks' },
    { key: 'json', label: 'JSON' },
];

const isCommission = (s: Setting) => /commission|komisi/i.test(s.key) || /commission|komisi/i.test(s.category ?? '');

/** Komisi disimpan sebagai pecahan: 0.15 → "15% (0.15)" */
const displayValue = (s: Setting) => {
    if (s.value_type === 'boolean') return s.value === 'true' ? 'Aktif' : 'Nonaktif';
    if (s.value_type === 'number' && isCommission(s)) {
        const n = Number(s.value);
        if (Number.isFinite(n) && n >= 0 && n <= 1) return `${+(n * 100).toFixed(2)}%  (${s.value})`;
    }
    return s.value;
};

// ============================================================
// KOMPONEN KECIL
// ============================================================
function Field({
    label,
    hint,
    ...props
}: {
    label: string;
    hint?: string;
} & React.ComponentProps<typeof TextInput>) {
    return (
        <View style={s.field}>
            <Text style={s.fieldLabel}>{label}</Text>
            <TextInput
                {...props}
                style={[s.input, props.multiline && s.inputMulti, props.editable === false && s.inputDisabled]}
                placeholderTextColor={COLORS.placeholder}
                accessibilityLabel={label}
            />
            {!!hint && <Text style={s.hint}>{hint}</Text>}
        </View>
    );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <View style={s.switchRow}>
            <Text style={s.fieldLabel}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: COLORS.line, true: COLORS.primary }}
                thumbColor="#ffffff"
            />
        </View>
    );
}

// ============================================================
// FORM STATE
// ============================================================
type TariffForm = {
    mode: 'create' | 'edit';
    code: string;
    label: string;
    min_fare: string;
    per_km: string;
    base_km: string;
    capacity: string;
    eta_min: string;
    desc_text: string;
    sort_order: string;
    is_active: boolean;
};

const emptyTariff: TariffForm = {
    mode: 'create',
    code: '',
    label: '',
    min_fare: '',
    per_km: '',
    base_km: '',
    capacity: '',
    eta_min: '',
    desc_text: '',
    sort_order: '',
    is_active: true,
};

const tariffToForm = (t: Tariff): TariffForm => ({
    mode: 'edit',
    code: t.code,
    label: t.label ?? '',
    min_fare: String(t.min_fare ?? ''),
    per_km: String(t.per_km ?? ''),
    base_km: String(t.base_km ?? ''),
    capacity: t.capacity != null ? String(t.capacity) : '',
    eta_min: t.eta_min != null ? String(t.eta_min) : '',
    desc_text: t.desc_text ?? '',
    sort_order: t.sort_order != null ? String(t.sort_order) : '',
    is_active: t.is_active !== false,
});

type SettingForm = {
    mode: 'create' | 'edit';
    key: string;
    value: string;
    value_type: ValueType;
    category: string;
    is_public: boolean;
};

const emptySetting: SettingForm = {
    mode: 'create',
    key: '',
    value: '',
    value_type: 'number',
    category: 'commission',
    is_public: false,
};

// ============================================================
// SCREEN
// ============================================================
export default function TarifKomisiScreen() {
    const [tab, setTab] = useState<'tarif' | 'komisi' | 'pengaturan'>('tarif');
    const settingFilter: string = 'semua'; // tab Pengaturan menampilkan semua key app_settings
    const [commissionAddTick, setCommissionAddTick] = useState(0); // memicu form komisi baru
    const [refreshTick, setRefreshTick] = useState(0); // memicu muat ulang panel komisi

    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [settings, setSettings] = useState<Setting[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tError, setTError] = useState<string | null>(null);
    const [sError, setSError] = useState<string | null>(null);
    const error = tab === 'tarif' ? tError : sError; // galat sesuai tab yang sedang dibuka

    // Sheet tarif
    const [tForm, setTForm] = useState<TariffForm | null>(null);
    const [tConfirmDelete, setTConfirmDelete] = useState(false);
    const [simKm, setSimKm] = useState('');
    const [simResult, setSimResult] = useState<string | null>(null);
    const [simBusy, setSimBusy] = useState(false);

    // Sheet pengaturan
    const [sForm, setSForm] = useState<SettingForm | null>(null);
    const [sConfirmDelete, setSConfirmDelete] = useState(false);

    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // ── Muat data ──
    // Tarif dan pengaturan dimuat terpisah: kalau salah satu gagal, yang lain tetap tampil
    const load = useCallback(async () => {
        setTError(null);
        setSError(null);
        const [t, st] = await Promise.allSettled([
            adminCall<Tariff[]>('tariffs'),
            adminCall<Setting[]>('settings'),
        ]);

        if (t.status === 'fulfilled') setTariffs(Array.isArray(t.value) ? t.value : []);
        else {
            console.warn('[TARIF-KOMISI] Tarif gagal:', (t.reason as any)?.message);
            setTError((t.reason as any)?.message ?? 'Gagal memuat tarif');
        }

        if (st.status === 'fulfilled') setSettings(Array.isArray(st.value) ? st.value : []);
        else {
            console.warn('[TARIF-KOMISI] Pengaturan gagal:', (st.reason as any)?.message);
            setSError((st.reason as any)?.message ?? 'Gagal memuat pengaturan');
        }

        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const visibleSettings = useMemo(
        () => (settingFilter === 'komisi' ? settings.filter(isCommission) : settings),
        [settings, settingFilter]
    );

    const grouped = useMemo(() => {
        const map = new Map<string, Setting[]>();
        visibleSettings.forEach((x) => {
            const c = x.category || 'general';
            if (!map.has(c)) map.set(c, []);
            map.get(c)!.push(x);
        });
        return Array.from(map.entries());
    }, [visibleSettings]);

    // ── Tarif: aksi ──
    const closeTariff = () => {
        setTForm(null);
        setTConfirmDelete(false);
        setSimKm('');
        setSimResult(null);
        setActionError(null);
    };

    const saveTariff = async () => {
        if (!tForm) return;
        const f = tForm;

        if (f.mode === 'create' && !f.code.trim()) return setActionError('Kode tarif wajib diisi.');
        if (!f.label.trim()) return setActionError('Label wajib diisi.');
        for (const [k, v] of [
            ['Tarif minimum', f.min_fare],
            ['Tarif per km', f.per_km],
            ['Jarak dasar', f.base_km],
        ] as const) {
            if (v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0) {
                return setActionError(`${k} harus berupa angka 0 atau lebih.`);
            }
        }

        const body: Record<string, unknown> = {
            label: f.label.trim(),
            min_fare: Number(f.min_fare),
            per_km: Number(f.per_km),
            base_km: Number(f.base_km),
            desc_text: f.desc_text.trim(),
            is_active: f.is_active,
        };
        if (f.capacity.trim() !== '') body.capacity = Number(f.capacity);
        if (f.eta_min.trim() !== '') body.eta_min = Number(f.eta_min);
        if (f.sort_order.trim() !== '') body.sort_order = Number(f.sort_order);

        setBusy(true);
        setActionError(null);
        try {
            if (f.mode === 'create') await adminCall('createTariff', { code: f.code.trim().toLowerCase(), ...body });
            else await adminCall('updateTariff', f.code, body);
            closeTariff();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menyimpan tarif.');
        } finally {
            setBusy(false);
        }
    };

    const deleteTariff = async () => {
        if (!tForm) return;
        setBusy(true);
        setActionError(null);
        try {
            await adminCall('deleteTariff', tForm.code);
            closeTariff();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menghapus tarif.');
            setTConfirmDelete(false);
        } finally {
            setBusy(false);
        }
    };

    const simulate = async () => {
        if (!tForm) return;
        const km = Number(simKm);
        if (!Number.isFinite(km) || km <= 0) return setSimResult('Isi jarak (km) yang valid.');
        setSimBusy(true);
        try {
            const r = await adminCall<any>('calculateTariff', tForm.code, km);
            setSimResult(r?.price != null ? `${km} km → ${rupiah(num(r.price))}` : 'Hasil tidak tersedia.');
        } catch (e: any) {
            setSimResult(e?.message ?? 'Gagal menghitung.');
        } finally {
            setSimBusy(false);
        }
    };

    // ── Pengaturan: aksi ──
    const closeSetting = () => {
        setSForm(null);
        setSConfirmDelete(false);
        setActionError(null);
    };

    const saveSetting = async () => {
        if (!sForm) return;
        const f = sForm;
        if (f.mode === 'create' && !f.key.trim()) return setActionError('Key wajib diisi.');
        if (f.value_type !== 'boolean' && f.value.trim() === '') return setActionError('Nilai tidak boleh kosong.');
        if (f.value_type === 'number' && !Number.isFinite(Number(f.value))) {
            return setActionError('Nilai harus berupa angka.');
        }

        setBusy(true);
        setActionError(null);
        try {
            if (f.mode === 'create') {
                await adminCall('createSetting', {
                    key: f.key.trim().toLowerCase(),
                    value: f.value.trim(),
                    value_type: f.value_type,
                    category: f.category.trim() || 'general',
                    is_public: f.is_public,
                });
            } else {
                await adminCall('updateSetting', f.key, {
                    value: f.value.trim(),
                    category: f.category.trim() || 'general',
                    is_public: f.is_public,
                });
            }
            closeSetting();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menyimpan pengaturan.');
        } finally {
            setBusy(false);
        }
    };

    const deleteSetting = async () => {
        if (!sForm) return;
        setBusy(true);
        setActionError(null);
        try {
            await adminCall('deleteSetting', sForm.key);
            closeSetting();
            load();
        } catch (e: any) {
            setActionError(e?.message ?? 'Gagal menghapus pengaturan.');
            setSConfirmDelete(false);
        } finally {
            setBusy(false);
        }
    };

    const setT = (patch: Partial<TariffForm>) => setTForm((f) => (f ? { ...f, ...patch } : f));
    const setS = (patch: Partial<SettingForm>) => setSForm((f) => (f ? { ...f, ...patch } : f));

    // ============================================================
    // RENDER
    // ============================================================
    const onAdd = () => {
        setActionError(null);
        if (tab === 'tarif') setTForm({ ...emptyTariff });
        else if (tab === 'komisi') setCommissionAddTick((t) => t + 1);
        else setSForm({ ...emptySetting, category: 'general' });
    };

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <ScrollView
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            setRefreshTick((t) => t + 1);
                            load();
                        }}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {/* ── Header ── */}
                <View style={s.header}>
                    <TouchableOpacity
                        style={s.backBtn}
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/akun' as any))}
                        accessibilityLabel="Kembali"
                    >
                        <Ionicons name="chevron-back" size={22} color={COLORS.ink} />
                    </TouchableOpacity>
                    <Text style={s.title}>Tarif dan komisi</Text>
                    <TouchableOpacity style={s.addBtn} onPress={onAdd} accessibilityLabel="Tambah">
                        <Ionicons name="add" size={20} color="#ffffff" />
                        <Text style={s.addText}>Tambah</Text>
                    </TouchableOpacity>
                </View>

                <Segmented
                    options={[
                        { key: 'tarif', label: 'Tarif' },
                        { key: 'komisi', label: 'Komisi' },
                        { key: 'pengaturan', label: 'Lainnya' },
                    ]}
                    value={tab}
                    onChange={(k) => setTab(k as 'tarif' | 'komisi' | 'pengaturan')}
                />

                {/* ── Isi ── */}
                {tab === 'komisi' ? (
                    <CommissionRatesPanel
                        tariffs={tariffs.map((t) => ({ code: t.code, label: t.label }))}
                        addTick={commissionAddTick}
                        refreshTick={refreshTick}
                    />
                ) : loading ? (
                    <ActivityIndicator style={{ marginTop: 48 }} size="large" color={COLORS.primary} />
                ) : error ? (
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
                ) : tab === 'tarif' ? (
                    tariffs.length === 0 ? (
                        <Text style={s.empty}>Belum ada tarif. Ketuk Tambah untuk membuat tarif pertama.</Text>
                    ) : (
                        tariffs.map((t) => (
                            <Pressable
                                key={t.code}
                                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                                onPress={() => {
                                    setActionError(null);
                                    setTForm(tariffToForm(t));
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Tarif ${t.label}`}
                            >
                                <View style={{ flex: 1 }}>
                                    <View style={s.nameRow}>
                                        <Text style={s.cardTitle} numberOfLines={1}>
                                            {t.label}
                                        </Text>
                                        <Badge
                                            tone={t.is_active ? 'ok' : 'neutral'}
                                            label={t.is_active ? 'Aktif' : 'Nonaktif'}
                                        />
                                    </View>
                                    <Text style={s.code}>{t.code}</Text>
                                    <Text style={s.cardMeta}>
                                        {rupiah(num(t.min_fare))} sampai {num(t.base_km)} km, lalu{' '}
                                        {rupiah(num(t.per_km))}/km
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                            </Pressable>
                        ))
                    )
                ) : grouped.length === 0 ? (
                    <Text style={s.empty}>Belum ada pengaturan. Ketuk Tambah untuk membuat.</Text>
                ) : (
                    grouped.map(([cat, list]) => (
                        <View key={cat} style={{ gap: 10 }}>
                            <Text style={s.groupLabel}>{cat}</Text>
                            {list.map((st) => (
                                <Pressable
                                    key={st.key}
                                    style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                                    onPress={() => {
                                        setActionError(null);
                                        setSForm({
                                            mode: 'edit',
                                            key: st.key,
                                            value: st.value,
                                            value_type: st.value_type,
                                            category: st.category ?? 'general',
                                            is_public: st.is_public === true,
                                        });
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Pengaturan ${st.key}`}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.code}>{st.key}</Text>
                                        <Text style={s.settingValue} numberOfLines={2}>
                                            {displayValue(st)}
                                        </Text>
                                    </View>
                                    <Badge tone="info" label={st.value_type} />
                                </Pressable>
                            ))}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* ══════════ Sheet: tarif ══════════ */}
            <BottomSheet
                visible={!!tForm}
                onClose={closeTariff}
                title={tForm?.mode === 'create' ? 'Tarif baru' : 'Ubah tarif'}
            >
                {tForm && !tConfirmDelete && (
                    <>
                        <Field
                            label="Kode"
                            value={tForm.code}
                            onChangeText={(v) => setT({ code: v })}
                            editable={tForm.mode === 'create'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder="mis. uride_s"
                            hint={
                                tForm.mode === 'create'
                                    ? 'Huruf kecil, angka, dan _. Tidak bisa diubah setelah dibuat.'
                                    : 'Kode tidak bisa diubah.'
                            }
                        />
                        <Field
                            label="Label"
                            value={tForm.label}
                            onChangeText={(v) => setT({ label: v })}
                            placeholder="mis. URide S"
                        />
                        <Field
                            label="Tarif minimum (Rp)"
                            value={tForm.min_fare}
                            onChangeText={(v) => setT({ min_fare: v })}
                            keyboardType="numeric"
                            placeholder="10000"
                        />
                        <Field
                            label="Jarak dasar (km)"
                            value={tForm.base_km}
                            onChangeText={(v) => setT({ base_km: v })}
                            keyboardType="decimal-pad"
                            placeholder="2"
                            hint="Jarak yang sudah tercakup tarif minimum."
                        />
                        <Field
                            label="Tarif per km (Rp)"
                            value={tForm.per_km}
                            onChangeText={(v) => setT({ per_km: v })}
                            keyboardType="numeric"
                            placeholder="3000"
                            hint="Dikenakan untuk tiap km setelah jarak dasar."
                        />
                        <Field
                            label="Kapasitas"
                            value={tForm.capacity}
                            onChangeText={(v) => setT({ capacity: v })}
                            keyboardType="number-pad"
                            placeholder="opsional"
                        />
                        <Field
                            label="Estimasi (menit)"
                            value={tForm.eta_min}
                            onChangeText={(v) => setT({ eta_min: v })}
                            keyboardType="number-pad"
                            placeholder="opsional"
                        />
                        <Field
                            label="Deskripsi"
                            value={tForm.desc_text}
                            onChangeText={(v) => setT({ desc_text: v })}
                            multiline
                            placeholder="opsional"
                        />
                        <Field
                            label="Urutan tampil"
                            value={tForm.sort_order}
                            onChangeText={(v) => setT({ sort_order: v })}
                            keyboardType="number-pad"
                            placeholder="kosong = di paling akhir"
                        />
                        <SwitchRow label="Tarif aktif" value={tForm.is_active} onChange={(v) => setT({ is_active: v })} />

                        {/* Uji hitung */}
                        {tForm.mode === 'edit' && (
                            <View style={s.simBox}>
                                <Text style={s.fieldLabel}>Uji hitung tarif tersimpan</Text>
                                <View style={s.simRow}>
                                    <TextInput
                                        style={[s.input, { flex: 1 }]}
                                        value={simKm}
                                        onChangeText={setSimKm}
                                        keyboardType="decimal-pad"
                                        placeholder="Jarak (km)"
                                        placeholderTextColor={COLORS.placeholder}
                                        accessibilityLabel="Jarak uji hitung"
                                    />
                                    <TouchableOpacity style={s.simBtn} onPress={simulate} disabled={simBusy}>
                                        {simBusy ? (
                                            <ActivityIndicator size="small" color={COLORS.primary} />
                                        ) : (
                                            <Text style={s.simBtnText}>Hitung</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                {!!simResult && <Text style={s.simResult}>{simResult}</Text>}
                                <Text style={s.hint}>Memakai tarif yang sudah disimpan, bukan isian di atas.</Text>
                            </View>
                        )}

                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel="Simpan"
                            cancelLabel="Batal"
                            busy={busy}
                            onConfirm={saveTariff}
                            onCancel={closeTariff}
                        />
                        {tForm.mode === 'edit' && (
                            <SheetButton
                                label="Hapus tarif"
                                tone="danger"
                                onPress={() => {
                                    setActionError(null);
                                    setTConfirmDelete(true);
                                }}
                            />
                        )}
                    </>
                )}

                {tForm && tConfirmDelete && (
                    <>
                        <Text style={s.confirmText}>
                            Hapus tarif {tForm.label} ({tForm.code})? Tarif yang sudah pernah dipakai pesanan tidak bisa
                            dihapus. Untuk itu, nonaktifkan saja.
                        </Text>
                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel="Hapus"
                            danger
                            busy={busy}
                            onConfirm={deleteTariff}
                            onCancel={() => setTConfirmDelete(false)}
                        />
                    </>
                )}
            </BottomSheet>

            {/* ══════════ Sheet: pengaturan ══════════ */}
            <BottomSheet
                visible={!!sForm}
                onClose={closeSetting}
                title={sForm?.mode === 'create' ? 'Pengaturan baru' : 'Ubah pengaturan'}
            >
                {sForm && !sConfirmDelete && (
                    <>
                        <Field
                            label="Key"
                            value={sForm.key}
                            onChangeText={(v) => setS({ key: v })}
                            editable={sForm.mode === 'create'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder="mis. commission_food"
                            hint={
                                sForm.mode === 'create'
                                    ? 'Huruf kecil, angka, _ atau titik. Tidak bisa diubah setelah dibuat.'
                                    : 'Key tidak bisa diubah.'
                            }
                        />

                        {sForm.mode === 'create' && (
                            <View style={s.field}>
                                <Text style={s.fieldLabel}>Tipe nilai</Text>
                                <FilterChips
                                    options={VALUE_TYPES}
                                    value={sForm.value_type}
                                    onChange={(k) =>
                                        setS({ value_type: k as ValueType, value: k === 'boolean' ? 'true' : '' })
                                    }
                                />
                            </View>
                        )}

                        {sForm.value_type === 'boolean' ? (
                            <SwitchRow
                                label="Nilai"
                                value={sForm.value === 'true'}
                                onChange={(v) => setS({ value: v ? 'true' : 'false' })}
                            />
                        ) : (
                            <Field
                                label="Nilai"
                                value={sForm.value}
                                onChangeText={(v) => setS({ value: v })}
                                keyboardType={sForm.value_type === 'number' ? 'decimal-pad' : 'default'}
                                multiline={sForm.value_type === 'json' || sForm.value_type === 'string'}
                                autoCapitalize="none"
                                placeholder={sForm.value_type === 'number' ? '0.15' : ''}
                                hint={
                                    sForm.value_type === 'number' && /commission|komisi/i.test(sForm.key)
                                        ? Number(sForm.value) >= 0 && Number(sForm.value) <= 1 && sForm.value !== ''
                                            ? `= ${+(Number(sForm.value) * 100).toFixed(2)}%`
                                            : 'Komisi harus antara 0 dan 1 (0.15 = 15%).'
                                        : undefined
                                }
                            />
                        )}

                        <Field
                            label="Kategori"
                            value={sForm.category}
                            onChangeText={(v) => setS({ category: v })}
                            autoCapitalize="none"
                            placeholder="mis. commission"
                        />
                        <SwitchRow
                            label="Publik (terbaca tanpa login)"
                            value={sForm.is_public}
                            onChange={(v) => setS({ is_public: v })}
                        />
                        {sForm.is_public && (
                            <Text style={s.warn}>
                                Nilai ini akan dikirim ke semua pengguna lewat /api/settings/public. Jangan isi data
                                rahasia.
                            </Text>
                        )}

                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel="Simpan"
                            busy={busy}
                            onConfirm={saveSetting}
                            onCancel={closeSetting}
                        />
                        {sForm.mode === 'edit' && (
                            <SheetButton
                                label="Hapus pengaturan"
                                tone="danger"
                                onPress={() => {
                                    setActionError(null);
                                    setSConfirmDelete(true);
                                }}
                            />
                        )}
                    </>
                )}

                {sForm && sConfirmDelete && (
                    <>
                        <Text style={s.confirmText}>
                            Hapus pengaturan {sForm.key}? Bagian aplikasi yang membacanya akan memakai nilai bawaan,
                            sehingga komisi atau tarif bisa berubah. Pastikan kamu yakin.
                        </Text>
                        <SheetError message={actionError} />
                        <SheetButtons
                            confirmLabel="Hapus"
                            danger
                            busy={busy}
                            onConfirm={deleteSetting}
                            onCancel={() => setSConfirmDelete(false)}
                        />
                    </>
                )}
            </BottomSheet>
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scroll: { padding: 20, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: COLORS.ink },
    addBtn: {
        height: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },

    note: { fontSize: 12, lineHeight: 18, color: COLORS.muted },

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
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    cardTitle: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: COLORS.ink },
    code: { marginTop: 4, fontSize: 12, fontWeight: '700', color: COLORS.muted },
    cardMeta: { marginTop: 6, fontSize: 13, color: COLORS.ink },
    settingValue: { marginTop: 6, fontSize: 15, fontWeight: '800', color: COLORS.ink },
    groupLabel: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },

    empty: { marginTop: 32, textAlign: 'center', fontSize: 13, lineHeight: 20, color: COLORS.muted },
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

    // Form
    field: { marginTop: 14 },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
    input: {
        minHeight: 48,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        fontSize: 15,
        color: COLORS.ink,
        backgroundColor: COLORS.white,
    },
    inputMulti: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
    inputDisabled: { backgroundColor: COLORS.surface, color: COLORS.muted },
    hint: { marginTop: 6, fontSize: 12, color: COLORS.muted },
    switchRow: {
        marginTop: 14,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    warn: { marginTop: 4, fontSize: 12, lineHeight: 18, color: COLORS.warnFg },
    confirmText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },

    simBox: {
        marginTop: 18,
        padding: 14,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
    },
    simRow: { flexDirection: 'row', gap: 10 },
    simBtn: {
        width: 84,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    simBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
    simResult: { marginTop: 10, fontSize: 15, fontWeight: '800', color: COLORS.ink },
});