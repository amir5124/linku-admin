// components/AdminUi.tsx — komponen UI bersama untuk layar admin
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { COLORS } from '../lib/adminKit';

// ── Badge ──
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
    ok: { bg: COLORS.okBg, fg: COLORS.okFg },
    warn: { bg: COLORS.warnBg, fg: COLORS.warnFg },
    danger: { bg: COLORS.dangerBg, fg: COLORS.danger },
    info: { bg: COLORS.infoBg, fg: COLORS.infoFg },
    neutral: { bg: COLORS.neutralBg, fg: COLORS.muted },
};

export function Badge({ tone, label }: { tone: Tone; label: string }) {
    const t = TONES[tone];
    return (
        <View style={[ui.badge, { backgroundColor: t.bg }]}>
            <Text style={[ui.badgeText, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

// ── Segmented (Merchant | Driver, dst) ──
export function Segmented({
    options,
    value,
    onChange,
}: {
    options: { key: string; label: string }[];
    value: string;
    onChange: (key: string) => void;
}) {
    return (
        <View style={ui.segment}>
            {options.map((o) => {
                const active = o.key === value;
                return (
                    <Pressable
                        key={o.key}
                        style={[ui.segmentItem, active && ui.segmentItemActive]}
                        onPress={() => onChange(o.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        <Text style={[ui.segmentText, active && ui.segmentTextActive]}>{o.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

// ── Chip filter ──
export function FilterChips({
    options,
    value,
    onChange,
}: {
    options: { key: string; label: string; count?: number }[];
    value: string;
    onChange: (key: string) => void;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            keyboardShouldPersistTaps="handled"
        >
            {options.map((o) => {
                const active = o.key === value;
                return (
                    <Pressable
                        key={o.key}
                        style={[ui.chip, active && ui.chipActive]}
                        onPress={() => onChange(o.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        <Text style={[ui.chipText, active && ui.chipTextActive]}>
                            {o.label}
                            {o.count != null ? ` ${o.count}` : ''}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

// ── Kosong / error / loading untuk FlatList ──
export function ListEmpty({
    loading,
    error,
    onRetry,
    icon = 'file-tray-outline',
    title,
    text,
}: {
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    text: string;
}) {
    if (loading) {
        return (
            <View style={ui.state}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }
    if (error) {
        return (
            <View style={ui.state}>
                <Ionicons name="cloud-offline-outline" size={44} color={COLORS.muted} />
                <Text style={ui.stateText}>{error}</Text>
                <TouchableOpacity style={ui.retry} onPress={onRetry}>
                    <Text style={ui.retryText}>Coba Lagi</Text>
                </TouchableOpacity>
            </View>
        );
    }
    return (
        <View style={ui.state}>
            <View style={ui.emptyIcon}>
                <Ionicons name={icon} size={36} color={COLORS.muted} />
            </View>
            <Text style={ui.stateTitle}>{title}</Text>
            <Text style={ui.stateText}>{text}</Text>
        </View>
    );
}

// ── Bottom sheet ──
export function BottomSheet({
    visible,
    onClose,
    title,
    children,
}: {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={ui.overlay}>
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={ui.sheet}>
                        <TouchableOpacity
                            style={ui.close}
                            onPress={onClose}
                            accessibilityLabel="Tutup"
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>
                        {!!title && (
                            <Text style={ui.sheetTitle} numberOfLines={2}>
                                {title}
                            </Text>
                        )}
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {children}
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

/** Tombol Batal + Konfirmasi di dalam sheet */
export function SheetButtons({
    confirmLabel,
    onConfirm,
    onCancel,
    cancelLabel = 'Batal',
    busy,
    danger,
}: {
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    cancelLabel?: string;
    busy?: boolean;
    danger?: boolean;
}) {
    return (
        <View style={ui.btnRow}>
            <TouchableOpacity style={[ui.btn, ui.btnGhost]} onPress={onCancel} disabled={busy}>
                <Text style={ui.btnGhostText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[ui.btn, danger ? ui.btnDanger : ui.btnPrimary, busy && { opacity: 0.6 }]}
                onPress={onConfirm}
                disabled={busy}
            >
                {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={ui.btnFilledText}>{confirmLabel}</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

/** Tombol lebar tunggal di dalam sheet */
export function SheetButton({
    label,
    onPress,
    tone = 'primary',
}: {
    label: string;
    onPress: () => void;
    tone?: 'primary' | 'danger';
}) {
    return (
        <TouchableOpacity
            style={[ui.btnFull, tone === 'danger' ? ui.btnFullDanger : ui.btnPrimary]}
            onPress={onPress}
        >
            <Text style={tone === 'danger' ? ui.btnFullDangerText : ui.btnFilledText}>{label}</Text>
        </TouchableOpacity>
    );
}

export function SheetError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <View style={ui.errorBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
            <Text style={ui.errorText}>{message}</Text>
        </View>
    );
}

/** Baris "label … nilai"; baris tanpa nilai disembunyikan */
export function DetailRows({ rows }: { rows: [string, string | number | null | undefined][] }) {
    return (
        <View>
            {rows
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                    <View key={k} style={ui.detailRow}>
                        <Text style={ui.detailKey}>{k}</Text>
                        <Text style={ui.detailVal}>{String(v)}</Text>
                    </View>
                ))}
        </View>
    );
}

/** Isian teks berlabel */
export function Field({
    label,
    hint,
    ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
    return (
        <View style={ui.field}>
            <Text style={ui.fieldLabel}>{label}</Text>
            <TextInput
                {...props}
                style={[ui.input, props.editable === false && ui.inputDisabled]}
                placeholderTextColor={COLORS.placeholder}
                accessibilityLabel={label}
            />
            {!!hint && <Text style={ui.hint}>{hint}</Text>}
        </View>
    );
}

/** Baris label + saklar */
export function SwitchRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <View style={ui.switchRow}>
            <Text style={ui.fieldLabel}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: COLORS.line, true: COLORS.primary }}
                thumbColor="#ffffff"
            />
        </View>
    );
}

export const ui = StyleSheet.create({
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

    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '800' },

    segment: {
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: 14,
        backgroundColor: COLORS.neutralBg,
    },
    segmentItem: {
        flex: 1,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: COLORS.white },
    segmentText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
    segmentTextActive: { color: COLORS.ink },

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

    state: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
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

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        maxHeight: '85%',
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 36,
    },
    close: {
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
    sheetTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginBottom: 12 },

    btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    btn: { flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white },
    btnGhostText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
    btnPrimary: { backgroundColor: COLORS.primary },
    btnDanger: { backgroundColor: COLORS.danger },
    btnFilledText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
    btnFull: {
        height: 50,
        marginTop: 20,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnFullDanger: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.danger },
    btnFullDangerText: { fontSize: 15, fontWeight: '800', color: COLORS.danger },

    errorBox: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: COLORS.dangerBg,
    },
    errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.danger },

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
});