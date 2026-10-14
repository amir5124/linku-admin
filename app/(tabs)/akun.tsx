// app/(tabs)/akun.tsx — Akun admin Waruung
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, BottomSheet, SheetButtons } from '../../components/AdminUi';
import { adminCall, COLORS, formatDateTime, initials } from '../../lib/adminKit';
import { clearToken } from '../../lib/api';

type SheetKind = 'admins' | 'audit' | 'soon' | 'logout' | null;

type AdminRow = { id: string; full_name?: string | null; email?: string | null; is_active?: boolean | null };
type AuditRow = {
    id: string;
    action: string;
    target_type: string;
    admin_name?: string | null;
    created_at: string;
};

const AUDIT_LABEL: Record<string, string> = {
    verify_merchant: 'Verifikasi merchant',
    verify_driver: 'Verifikasi driver',
    suspend_partner: 'Tangguhkan mitra',
    activate_partner: 'Aktifkan mitra',
    approve_withdrawal: 'Setujui penarikan',
    reject_withdrawal: 'Tolak penarikan',
    approve_payout: 'Setujui pengajuan payout',
    reject_payout: 'Tolak pengajuan payout',
    create_tariff: 'Buat tarif',
    update_tariff: 'Ubah tarif',
    delete_tariff: 'Hapus tarif',
    create_setting: 'Buat pengaturan',
    update_setting: 'Ubah pengaturan',
    delete_setting: 'Hapus pengaturan',
    create_commission: 'Buat komisi',
    update_commission: 'Ubah komisi',
    delete_commission: 'Hapus komisi',
};

export default function AkunScreen() {
    const [profile, setProfile] = useState<{ full_name?: string; email?: string } | null>(null);
    const [sheet, setSheet] = useState<SheetKind>(null);
    const [soonTitle, setSoonTitle] = useState('');

    const [admins, setAdmins] = useState<AdminRow[]>([]);
    const [audit, setAudit] = useState<AuditRow[]>([]);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [sheetError, setSheetError] = useState<string | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    useFocusEffect(
        useCallback(() => {
            AsyncStorage.getItem('profile')
                .then((raw) => setProfile(raw ? JSON.parse(raw) : null))
                .catch(() => setProfile(null));
        }, [])
    );

    const name = profile?.full_name || 'Admin Waruung';

    const openAdmins = async () => {
        setSheet('admins');
        setLoadingSheet(true);
        setSheetError(null);
        try {
            const d = await adminCall<AdminRow[]>('admins');
            setAdmins(Array.isArray(d) ? d : []);
        } catch (e: any) {
            setSheetError(e?.message ?? 'Gagal memuat daftar admin');
        } finally {
            setLoadingSheet(false);
        }
    };

    const openAudit = async () => {
        setSheet('audit');
        setLoadingSheet(true);
        setSheetError(null);
        try {
            const d = await adminCall<{ items: AuditRow[] }>('auditLogs', { limit: 30, offset: 0 });
            setAudit(Array.isArray(d?.items) ? d.items : []);
        } catch (e: any) {
            setSheetError(e?.message ?? 'Gagal memuat aktivitas admin');
        } finally {
            setLoadingSheet(false);
        }
    };

    const openSoon = (title: string) => {
        setSoonTitle(title);
        setSheet('soon');
    };

    const logout = async () => {
        setLoggingOut(true);
        try {
            await clearToken();
            await AsyncStorage.removeItem('profile');
        } catch (e: any) {
            console.warn('[AKUN] Logout:', e?.message);
        } finally {
            setLoggingOut(false);
            setSheet(null);
            router.replace('/(auth)/login' as any);
        }
    };

    const menu: { label: string; soon?: boolean; onPress: () => void }[] = [
        { label: 'Kelola admin', onPress: openAdmins },
        { label: 'Tarif dan komisi', onPress: () => router.push('/tarif-komisi' as any) },
        { label: 'Notifikasi', soon: true, onPress: () => openSoon('Notifikasi') },
        { label: 'Keamanan', onPress: openAudit },
    ];

    const sheetTitle =
        sheet === 'admins'
            ? 'Kelola admin'
            : sheet === 'audit'
                ? 'Aktivitas admin'
                : sheet === 'soon'
                    ? soonTitle
                    : sheet === 'logout'
                        ? 'Keluar dari akun?'
                        : undefined;

    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <Text style={s.title}>Akun</Text>

                {/* ── Profil ── */}
                <View style={[s.card, s.profile]}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{initials(name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={s.meta} numberOfLines={1}>
                            {profile?.email || 'Admin'}
                        </Text>
                    </View>
                </View>

                {/* ── Menu ── */}
                <View style={[s.card, { paddingVertical: 0 }]}>
                    {menu.map((m, i) => (
                        <Pressable
                            key={m.label}
                            style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { opacity: 0.7 }]}
                            onPress={m.onPress}
                            accessibilityRole="button"
                        >
                            <Text style={s.rowLabel}>{m.label}</Text>
                            <View style={s.rowRight}>
                                {m.soon && <Badge tone="neutral" label="Segera" />}
                                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                            </View>
                        </Pressable>
                    ))}
                </View>

                <TouchableOpacity style={s.logoutBtn} onPress={() => setSheet('logout')}>
                    <Text style={s.logoutText}>Keluar</Text>
                </TouchableOpacity>
            </ScrollView>

            <BottomSheet visible={!!sheet} onClose={() => !loggingOut && setSheet(null)} title={sheetTitle}>
                {/* Admin & aktivitas: loading / error */}
                {(sheet === 'admins' || sheet === 'audit') && loadingSheet && (
                    <ActivityIndicator style={{ marginVertical: 32 }} size="large" color={COLORS.primary} />
                )}
                {(sheet === 'admins' || sheet === 'audit') && !loadingSheet && sheetError && (
                    <View style={s.sheetState}>
                        <Text style={s.stateText}>{sheetError}</Text>
                        <TouchableOpacity
                            style={s.retry}
                            onPress={sheet === 'admins' ? openAdmins : openAudit}
                        >
                            <Text style={s.retryText}>Coba Lagi</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {sheet === 'admins' &&
                    !loadingSheet &&
                    !sheetError &&
                    (admins.length === 0 ? (
                        <Text style={s.stateText}>Belum ada data admin.</Text>
                    ) : (
                        admins.map((a) => (
                            <View key={a.id} style={s.listRow}>
                                <View style={[s.avatar, s.avatarSm]}>
                                    <Text style={s.avatarText}>{initials(a.full_name)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.listName} numberOfLines={1}>
                                        {a.full_name || 'Tanpa nama'}
                                    </Text>
                                    <Text style={s.meta} numberOfLines={1}>
                                        {a.email || '-'}
                                    </Text>
                                </View>
                                <Badge
                                    tone={a.is_active === false ? 'danger' : 'ok'}
                                    label={a.is_active === false ? 'Nonaktif' : 'Aktif'}
                                />
                            </View>
                        ))
                    ))}

                {sheet === 'audit' &&
                    !loadingSheet &&
                    !sheetError &&
                    (audit.length === 0 ? (
                        <Text style={s.stateText}>Belum ada aktivitas tercatat.</Text>
                    ) : (
                        audit.map((r) => (
                            <View key={r.id} style={s.listRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.listName}>{AUDIT_LABEL[r.action] ?? r.action}</Text>
                                    <Text style={s.meta}>
                                        {r.admin_name || 'Admin'} · {formatDateTime(r.created_at)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    ))}

                {sheet === 'soon' && (
                    <Text style={s.confirmText}>
                        Fitur ini belum tersedia di aplikasi admin. Kami akan menambahkannya nanti.
                    </Text>
                )}

                {sheet === 'logout' && (
                    <>
                        <Text style={s.confirmText}>
                            Kamu harus masuk lagi untuk membuka panel admin.
                        </Text>
                        <SheetButtons
                            confirmLabel="Keluar"
                            danger
                            busy={loggingOut}
                            onConfirm={logout}
                            onCancel={() => setSheet(null)}
                        />
                    </>
                )}
            </BottomSheet>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scroll: { padding: 20, paddingBottom: 32, gap: 14 },
    title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: COLORS.ink, marginTop: 12 },

    card: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarSm: { width: 40, height: 40, borderRadius: 20 },
    avatarText: { fontWeight: '800', color: COLORS.infoFg },
    name: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
    meta: { marginTop: 4, fontSize: 12, color: COLORS.muted },

    row: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
    rowLabel: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    logoutBtn: {
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutText: { fontSize: 15, fontWeight: '800', color: COLORS.danger },

    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.line,
    },
    listName: { fontSize: 14, fontWeight: '800', color: COLORS.ink },

    confirmText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
    sheetState: { alignItems: 'center', paddingVertical: 16 },
    stateText: { fontSize: 13, lineHeight: 20, color: COLORS.muted, textAlign: 'center', paddingVertical: 16 },
    retry: {
        height: 44,
        paddingHorizontal: 24,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});