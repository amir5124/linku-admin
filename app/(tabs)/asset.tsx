// app/(tabs)/assets.tsx — Kelola aset aplikasi (banner, icon, marker, splash)
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import { api, ApiError, type AdminAsset } from '../../lib/api';
import { pickImage, pickImages, type PickedImage } from '../../lib/imagePicker';

// ============================================================
// COLORS
// ============================================================
const COLORS = {
    primary: '#1477b8',
    ink: '#12222f',
    muted: '#5b6b7b',
    line: '#e1e8ef',
    surface: '#f4f7fa',
    white: '#ffffff',
    success: '#16a34a',
    danger: '#dc2626',
    warnBg: '#fdf1e2',
    warnText: '#8a4a06',
    infoBg: '#e6f2fb',
    infoText: '#0f5c91',
};

// ============================================================
// KATEGORI
// ============================================================
type Category = 'banner' | 'icon' | 'marker' | 'splash' | 'other';

const CATEGORIES: { key: Category; label: string; icon: any }[] = [
    { key: 'banner', label: 'Banner', icon: 'image' },
    { key: 'icon', label: 'Icon', icon: 'apps' },
    { key: 'marker', label: 'Marker Map', icon: 'location' },
    { key: 'splash', label: 'Splash', icon: 'phone-portrait' },
    { key: 'other', label: 'Lainnya', icon: 'folder' },
];

const CATEGORY_LABEL: Record<Category, string> = {
    banner: 'Banner',
    icon: 'Icon',
    marker: 'Marker Map',
    splash: 'Splash',
    other: 'Lainnya',
};

// ============================================================
// UTIL
// ============================================================
const fmtSize = (bytes: number | null | undefined) => {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const fmtDate = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const errMsg = (e: any) =>
    e instanceof ApiError ? e.message : e?.message ?? 'Terjadi kesalahan';

// ============================================================
// BOTTOM SHEET STATE (pengganti Alert.alert)
// ============================================================
type SheetAction = {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'danger' | 'ghost';
    icon?: any;
};

type SheetState = {
    visible: boolean;
    title: string;
    message?: string;
    actions: SheetAction[];
};

const INITIAL_SHEET: SheetState = {
    visible: false,
    title: '',
    actions: [],
};

// ============================================================
// UPLOAD STATE
// ============================================================
type UploadState = {
    visible: boolean;
    mode: 'single' | 'bulk';
    total: number;
    current: number;
    currentFile: string;
    phase: 'preparing' | 'uploading' | 'done';
    results?: {
        success: number;
        failed: number;
        failedFiles: { name: string; error: string }[];
    };
};

const INITIAL_UPLOAD: UploadState = {
    visible: false,
    mode: 'single',
    total: 0,
    current: 0,
    currentFile: '',
    phase: 'preparing',
};

// ============================================================
// SCREEN
// ============================================================
export default function AssetsScreen() {
    // ---- Data ----
    const [items, setItems] = useState<AdminAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ---- Filter ----
    const [activeCat, setActiveCat] = useState<Category | 'all'>('all');
    const [search, setSearch] = useState('');
    const [activeOnly, setActiveOnly] = useState(false);

    // ---- Upload ----
    const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD);

    // ---- Detail modal ----
    const [detail, setDetail] = useState<AdminAsset | null>(null);

    // ---- Bottom sheet (pengganti Alert) ----
    const [sheet, setSheet] = useState<SheetState>(INITIAL_SHEET);

    // ============================================================
    // HELPER: Tampilkan bottom sheet
    // ============================================================
    const showSheet = (
        title: string,
        actions: SheetAction[],
        message?: string
    ) => {
        setSheet({ visible: true, title, message, actions });
    };

    const closeSheet = () => {
        setSheet(INITIAL_SHEET);
    };

    // ============================================================
    // LOAD
    // ============================================================
    const load = useCallback(async () => {
        try {
            setError(null);
            const res = await api.admin.assets.list({
                category: activeCat === 'all' ? undefined : activeCat,
                search: search.trim() || undefined,
                active_only: activeOnly || undefined,
                limit: 200,
            });
            setItems(res.items ?? []);
        } catch (e: any) {
            console.warn('[ASSETS] load gagal:', errMsg(e));
            setError(errMsg(e));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeCat, search, activeOnly]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    // ============================================================
    // UPLOAD — SINGLE
    // ============================================================
    const handleUploadSingle = async () => {
        try {
            const asset = await pickImage();
            if (!asset) return;

            // Tampilkan pilihan kategori via bottom sheet
            showSheet(
                'Pilih Kategori',
                CATEGORIES.map((c) => ({
                    label: c.label,
                    icon: c.icon,
                    variant: 'ghost' as const,
                    onPress: () => {
                        closeSheet();
                        doUploadSingle(asset, c.key);
                    },
                })),
                `File: ${asset.fileName}\nUkuran: ${fmtSize(asset.fileSize)}`
            );
        } catch (e: any) {
            showSheet('Gagal', [
                {
                    label: 'Mengerti',
                    onPress: closeSheet,
                    variant: 'primary',
                },
            ], errMsg(e));
        }
    };

    const doUploadSingle = async (
        asset: PickedImage,
        category: Category
    ) => {
        setUpload({
            visible: true,
            mode: 'single',
            total: 1,
            current: 0,
            currentFile: asset.fileName,
            phase: 'preparing',
        });

        await new Promise((r) => setTimeout(r, 150));
        setUpload((u) => ({ ...u, phase: 'uploading', current: 0.5 }));

        try {
            const created = await api.admin.assets.upload({
                uri: asset.uri,
                name: asset.fileName,
                mimeType: asset.mimeType,
                category,
            });

            setUpload((u) => ({
                ...u,
                phase: 'done',
                current: 1,
                results: { success: 1, failed: 0, failedFiles: [] },
            }));

            setTimeout(() => {
                setUpload(INITIAL_UPLOAD);
                load();
                showSheet(
                    'Berhasil',
                    [
                        {
                            label: 'Selesai',
                            onPress: closeSheet,
                            variant: 'primary',
                        },
                    ],
                    `Aset "${created.label ?? created.key}" berhasil diupload.`
                );
            }, 1200);
        } catch (e: any) {
            setUpload((u) => ({
                ...u,
                phase: 'done',
                current: 1,
                results: {
                    success: 0,
                    failed: 1,
                    failedFiles: [
                        { name: asset.fileName, error: errMsg(e) },
                    ],
                },
            }));

            setTimeout(() => {
                setUpload(INITIAL_UPLOAD);
                showSheet(
                    'Gagal Upload',
                    [
                        {
                            label: 'Mengerti',
                            onPress: closeSheet,
                            variant: 'primary',
                        },
                    ],
                    errMsg(e)
                );
            }, 1500);
        }
    };

    // ============================================================
    // UPLOAD — BULK
    // ============================================================
    const handleUploadBulk = async () => {
        try {
            const assets = await pickImages(20);
            if (!assets.length) return;

            if (assets.length === 1) {
                showSheet(
                    'Pilih Kategori',
                    CATEGORIES.map((c) => ({
                        label: c.label,
                        icon: c.icon,
                        variant: 'ghost' as const,
                        onPress: () => {
                            closeSheet();
                            doUploadSingle(assets[0], c.key);
                        },
                    })),
                    `File: ${assets[0].fileName}`
                );
                return;
            }

            showSheet(
                `Upload ${assets.length} File`,
                CATEGORIES.map((c) => ({
                    label: c.label,
                    icon: c.icon,
                    variant: 'ghost' as const,
                    onPress: () => {
                        closeSheet();
                        doUploadBulk(assets, c.key);
                    },
                })),
                'Semua file akan masuk ke satu kategori yang sama.'
            );
        } catch (e: any) {
            showSheet(
                'Gagal',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                errMsg(e)
            );
        }
    };

    const doUploadBulk = async (
        assets: PickedImage[],
        category: Category
    ) => {
        const total = assets.length;
        const failedFiles: { name: string; error: string }[] = [];
        let success = 0;

        setUpload({
            visible: true,
            mode: 'bulk',
            total,
            current: 0,
            currentFile: '',
            phase: 'preparing',
        });

        await new Promise((r) => setTimeout(r, 150));
        setUpload((u) => ({ ...u, phase: 'uploading' }));

        for (let i = 0; i < total; i++) {
            const a = assets[i];
            setUpload((u) => ({
                ...u,
                current: i,
                currentFile: a.fileName,
            }));

            try {
                await api.admin.assets.upload({
                    uri: a.uri,
                    name: a.fileName,
                    mimeType: a.mimeType,
                    category,
                });
                success++;
            } catch (e: any) {
                failedFiles.push({
                    name: a.fileName,
                    error: errMsg(e),
                });
            }

            setUpload((u) => ({ ...u, current: i + 1 }));
        }

        setUpload((u) => ({
            ...u,
            phase: 'done',
            current: total,
            results: {
                success,
                failed: failedFiles.length,
                failedFiles,
            },
        }));

        setTimeout(
            () => {
                setUpload(INITIAL_UPLOAD);
                load();

                if (failedFiles.length === 0) {
                    showSheet(
                        'Selesai',
                        [
                            {
                                label: 'Mengerti',
                                onPress: closeSheet,
                                variant: 'primary',
                            },
                        ],
                        `${success} file berhasil diupload.`
                    );
                } else {
                    showSheet(
                        'Selesai dengan Catatan',
                        [
                            {
                                label: 'Mengerti',
                                onPress: closeSheet,
                                variant: 'primary',
                            },
                        ],
                        `${success} berhasil, ${failedFiles.length} gagal.\n\n` +
                        failedFiles
                            .slice(0, 3)
                            .map((f) => `• ${f.name}: ${f.error}`)
                            .join('\n') +
                        (failedFiles.length > 3
                            ? `\n…dan ${failedFiles.length - 3} lainnya`
                            : '')
                    );
                }
            },
            1500
        );
    };

    // ============================================================
    // TOGGLE ACTIVE
    // ============================================================
    const toggleActive = async (asset: AdminAsset) => {
        try {
            const next = !asset.is_active;
            await api.admin.assets.update(asset.id, { is_active: next });
            setItems((prev) =>
                prev.map((it) =>
                    it.id === asset.id ? { ...it, is_active: next } : it
                )
            );
            if (detail?.id === asset.id) {
                setDetail({ ...detail, is_active: next });
            }
        } catch (e: any) {
            showSheet(
                'Gagal',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                errMsg(e)
            );
        }
    };

    // ============================================================
    // DELETE
    // ============================================================
    const handleDelete = (asset: AdminAsset) => {
        showSheet(
            'Hapus Aset',
            [
                {
                    label: 'Nonaktifkan',
                    icon: 'eye-off-outline',
                    onPress: () => {
                        closeSheet();
                        doDelete(asset, false);
                    },
                    variant: 'ghost',
                },
                {
                    label: 'Hapus Permanen',
                    icon: 'trash-outline',
                    onPress: () => {
                        closeSheet();
                        confirmHardDelete(asset);
                    },
                    variant: 'danger',
                },
            ],
            `"${asset.label ?? asset.key}"`
        );
    };

    const confirmHardDelete = (asset: AdminAsset) => {
        showSheet(
            '⚠️ Hapus Permanen',
            [
                {
                    label: 'Ya, Hapus Permanen',
                    icon: 'trash',
                    onPress: () => {
                        closeSheet();
                        doDelete(asset, true);
                    },
                    variant: 'danger',
                },
            ],
            'File akan dihapus dari storage dan tidak bisa dikembalikan. Lanjutkan?'
        );
    };

    const doDelete = async (asset: AdminAsset, hard: boolean) => {
        try {
            await api.admin.assets.remove(asset.id, hard);
            if (hard) {
                setItems((prev) =>
                    prev.filter((it) => it.id !== asset.id)
                );
                if (detail?.id === asset.id) setDetail(null);
            } else {
                setItems((prev) =>
                    prev.map((it) =>
                        it.id === asset.id
                            ? { ...it, is_active: false }
                            : it
                    )
                );
                if (detail?.id === asset.id) {
                    setDetail({ ...detail, is_active: false });
                }
            }
        } catch (e: any) {
            showSheet(
                'Gagal',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                errMsg(e)
            );
        }
    };

    // ============================================================
    // FILTERED
    // ============================================================
    const filtered = useMemo(() => {
        return items.filter((it) => {
            if (activeCat !== 'all' && it.category !== activeCat)
                return false;
            if (activeOnly && !it.is_active) return false;
            if (search) {
                const t = search.toLowerCase();
                return (
                    it.key.toLowerCase().includes(t) ||
                    (it.label ?? '').toLowerCase().includes(t)
                );
            }
            return true;
        });
    }, [items, activeCat, search, activeOnly]);

    const isUploading = upload.visible;

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <SafeAreaView edges={['top']} style={s.container}>
            {/* ── Header ── */}
            <View style={s.header}>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Kelola Aset</Text>
                    <Text style={s.headerSub}>
                        Banner, icon, marker & splash aplikasi
                    </Text>
                </View>

                <TouchableOpacity
                    style={s.iconHeaderBtn}
                    onPress={handleUploadBulk}
                    disabled={isUploading}
                >
                    <Ionicons
                        name="layers-outline"
                        size={20}
                        color={COLORS.primary}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.uploadBtn, isUploading && { opacity: 0.7 }]}
                    onPress={handleUploadSingle}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons
                                name="cloud-upload"
                                size={16}
                                color="#fff"
                            />
                            <Text style={s.uploadBtnText}>Upload</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* ── Search ── */}
            <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color={COLORS.muted} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Cari aset…"
                    placeholderTextColor={COLORS.muted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')}>
                        <Ionicons
                            name="close-circle"
                            size={18}
                            color={COLORS.muted}
                        />
                    </Pressable>
                )}
            </View>

            {/* ── Toggle aktif ── */}
            <View style={s.activeRow}>
                <Pressable
                    style={s.activeToggle}
                    onPress={() => setActiveOnly((v) => !v)}
                    hitSlop={8}
                >
                    <Ionicons
                        name={activeOnly ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={
                            activeOnly ? COLORS.primary : COLORS.muted
                        }
                    />
                    <Text style={s.activeToggleText}>
                        Hanya yang aktif
                    </Text>
                </Pressable>
            </View>

            {/* ── Chips ── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
            >
                <Chip
                    label="Semua"
                    icon="apps"
                    active={activeCat === 'all'}
                    onPress={() => setActiveCat('all')}
                />
                {CATEGORIES.map((c) => (
                    <Chip
                        key={c.key}
                        label={c.label}
                        icon={c.icon}
                        active={activeCat === c.key}
                        onPress={() => setActiveCat(c.key)}
                    />
                ))}
            </ScrollView>

            {/* ── Konten ── */}
            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator
                        size="large"
                        color={COLORS.primary}
                    />
                    <Text style={s.loadingText}>Memuat aset…</Text>
                </View>
            ) : error ? (
                <View style={s.center}>
                    <Ionicons
                        name="cloud-offline-outline"
                        size={44}
                        color={COLORS.muted}
                    />
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
                </View>
            ) : filtered.length === 0 ? (
                <View style={s.center}>
                    <Ionicons
                        name="images-outline"
                        size={56}
                        color={COLORS.muted}
                    />
                    <Text style={s.emptyText}>
                        {search || activeCat !== 'all' || activeOnly
                            ? 'Tidak ada aset yang cocok'
                            : 'Belum ada aset'}
                    </Text>
                    <Text style={s.emptyHint}>
                        Ketuk tombol Upload untuk mulai menambahkan
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(it) => String(it.id)}
                    numColumns={2}
                    columnWrapperStyle={s.row}
                    contentContainerStyle={s.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <AssetCard
                            asset={item}
                            onPress={() => setDetail(item)}
                            onToggle={() => toggleActive(item)}
                            onDelete={() => handleDelete(item)}
                        />
                    )}
                />
            )}

            {/* ── Detail Modal ── */}
            <AssetDetailModal
                asset={detail}
                onClose={() => setDetail(null)}
                onRefresh={load}
                showSheet={showSheet}
                closeSheet={closeSheet}
            />

            {/* ── Upload Progress Modal ── */}
            <UploadProgressModal
                state={upload}
                onClose={() => setUpload(INITIAL_UPLOAD)}
            />

            {/* ── Alert Bottom Sheet (pengganti Alert.alert) ── */}
            <AlertBottomSheet
                state={sheet}
                onClose={closeSheet}
            />
        </SafeAreaView>
    );
}

// ============================================================
// ALERT BOTTOM SHEET — pengganti Alert.alert
// ============================================================
function AlertBottomSheet({
    state,
    onClose,
}: {
    state: SheetState;
    onClose: () => void;
}) {
    if (!state.visible) return null;

    return (
        <Modal
            visible={state.visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={s.sheetOverlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <View style={s.sheetContainer}>
                    {/* Close button */}
                    <TouchableOpacity
                        onPress={onClose}
                        style={s.sheetCloseButton}
                        accessibilityLabel="Tutup"
                    >
                        <Ionicons name="close" size={24} color="#1c1c1c" />
                    </TouchableOpacity>

                    {/* Title */}
                    <Text style={s.sheetTitle}>{state.title}</Text>

                    {/* Message */}
                    {!!state.message && (
                        <Text style={s.sheetDescription}>
                            {state.message}
                        </Text>
                    )}

                    {/* Actions */}
                    <View style={{ gap: 10, marginTop: 8 }}>
                        {state.actions.map((a, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={a.onPress}
                                style={[
                                    s.sheetAction,
                                    a.variant === 'primary' &&
                                    s.sheetActionPrimary,
                                    a.variant === 'danger' &&
                                    s.sheetActionDanger,
                                    a.variant === 'ghost' &&
                                    s.sheetActionGhost,
                                ]}
                            >
                                {a.icon && (
                                    <Ionicons
                                        name={a.icon}
                                        size={18}
                                        color={
                                            a.variant === 'primary'
                                                ? '#fff'
                                                : a.variant === 'danger'
                                                    ? COLORS.danger
                                                    : COLORS.primary
                                        }
                                    />
                                )}
                                <Text
                                    style={[
                                        s.sheetActionText,
                                        a.variant === 'primary' && {
                                            color: '#fff',
                                        },
                                        a.variant === 'danger' && {
                                            color: COLORS.danger,
                                        },
                                    ]}
                                >
                                    {a.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ============================================================
// UPLOAD PROGRESS MODAL
// ============================================================
function UploadProgressModal({
    state,
    onClose,
}: {
    state: UploadState;
    onClose: () => void;
}) {
    if (!state.visible) return null;

    const pct =
        state.total > 0
            ? Math.min(100, Math.round((state.current / state.total) * 100))
            : 0;

    const isDone = state.phase === 'done';
    const isSingle = state.mode === 'single';

    return (
        <Modal
            visible={state.visible}
            transparent
            animationType="fade"
            onRequestClose={() => {
                if (
                    state.phase === 'uploading' ||
                    state.phase === 'preparing'
                )
                    return;
                onClose();
            }}
            statusBarTranslucent
        >
            <View style={s.upOverlay}>
                <View style={s.upCard}>
                    <View
                        style={[
                            s.upIconWrap,
                            {
                                backgroundColor: isDone
                                    ? state.results?.failed
                                        ? COLORS.warnBg
                                        : '#dcfce7'
                                    : COLORS.infoBg,
                            },
                        ]}
                    >
                        {isDone ? (
                            state.results?.failed ? (
                                <Ionicons
                                    name="alert-circle"
                                    size={32}
                                    color={COLORS.warnText}
                                />
                            ) : (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={32}
                                    color={COLORS.success}
                                />
                            )
                        ) : (
                            <ActivityIndicator
                                size="large"
                                color={COLORS.primary}
                            />
                        )}
                    </View>

                    <Text style={s.upTitle}>
                        {state.phase === 'preparing'
                            ? 'Menyiapkan…'
                            : state.phase === 'uploading'
                                ? isSingle
                                    ? 'Mengupload aset…'
                                    : `Mengupload ${state.current}/${state.total} file…`
                                : state.results?.failed
                                    ? 'Upload selesai dengan catatan'
                                    : 'Upload berhasil'}
                    </Text>

                    {!isDone && state.currentFile && (
                        <Text
                            style={s.upFilename}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                        >
                            {state.currentFile}
                        </Text>
                    )}

                    {!isDone && (
                        <View style={s.upBarWrap}>
                            <View style={s.upBarTrack}>
                                <View
                                    style={[
                                        s.upBarFill,
                                        { width: `${pct}%` },
                                    ]}
                                />
                            </View>
                            <Text style={s.upPct}>{pct}%</Text>
                        </View>
                    )}

                    {isDone && state.results && (
                        <View style={s.upResults}>
                            <View style={s.upResultRow}>
                                <View
                                    style={[
                                        s.upDot,
                                        {
                                            backgroundColor:
                                                COLORS.success,
                                        },
                                    ]}
                                />
                                <Text style={s.upResultText}>
                                    {state.results.success} berhasil
                                </Text>
                            </View>
                            {state.results.failed > 0 && (
                                <View style={s.upResultRow}>
                                    <View
                                        style={[
                                            s.upDot,
                                            {
                                                backgroundColor:
                                                    COLORS.danger,
                                            },
                                        ]}
                                    />
                                    <Text style={s.upResultText}>
                                        {state.results.failed} gagal
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {isDone && (
                        <TouchableOpacity
                            style={s.upCloseBtn}
                            onPress={onClose}
                        >
                            <Text style={s.upCloseText}>Tutup</Text>
                        </TouchableOpacity>
                    )}

                    {!isDone && (
                        <Text style={s.upHint}>
                            Jangan tutup halaman ini
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function AssetCard({
    asset,
    onPress,
    onToggle,
    onDelete,
}: {
    asset: AdminAsset;
    onPress: () => void;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const hasValidImage =
        typeof asset.public_url === 'string' &&
        asset.public_url.trim().length > 0 &&
        (asset.public_url.startsWith('http') ||
            asset.public_url.startsWith('data:'));

    // ✅ Hitung aspect ratio dari metadata (width/height)
    // Fallback ke 1 (persegi) kalau tidak ada data
    const aspectRatio = useMemo(() => {
        const w = Number(asset.width);
        const h = Number(asset.height);
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            // Batasi ratio biar tidak terlalu ekstrem (min 0.5, max 2)
            return Math.min(2, Math.max(0.5, w / h));
        }
        return 1; // fallback: persegi
    }, [asset.width, asset.height]);

    return (
        <Pressable style={s.card} onPress={onPress}>
            <View style={[s.thumbWrap, { aspectRatio }]}>
                {hasValidImage ? (
                    <Image
                        source={{ uri: asset.public_url }}
                        style={s.thumb}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[s.thumb, s.thumbPlaceholder]}>
                        <Ionicons
                            name="image-outline"
                            size={32}
                            color={COLORS.muted}
                        />
                    </View>
                )}

                {!asset.is_active && (
                    <View style={s.inactiveBadge}>
                        <Text style={s.inactiveText}>OFF</Text>
                    </View>
                )}

                <View style={s.catBadge}>
                    <Text style={s.catBadgeText}>
                        {asset.category.toUpperCase()}
                    </Text>
                </View>

                {/* ✅ Badge dimensi (opsional, untuk debugging) */}
                {asset.width && asset.height && (
                    <View style={s.dimBadge}>
                        <Text style={s.dimBadgeText}>
                            {asset.width}×{asset.height}
                        </Text>
                    </View>
                )}
            </View>

            <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={1}>
                    {asset.label ?? asset.key}
                </Text>
                <Text style={s.cardSub} numberOfLines={1}>
                    {fmtSize(asset.file_size)} · {fmtDate(asset.created_at)}
                </Text>

                <View style={s.cardActions}>
                    <Pressable
                        style={s.iconBtn}
                        onPress={onToggle}
                        hitSlop={6}
                    >
                        <Ionicons
                            name={
                                asset.is_active
                                    ? 'toggle'
                                    : 'toggle-outline'
                            }
                            size={22}
                            color={
                                asset.is_active
                                    ? COLORS.success
                                    : COLORS.muted
                            }
                        />
                    </Pressable>
                    <Pressable
                        style={s.iconBtn}
                        onPress={onDelete}
                        hitSlop={6}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={18}
                            color={COLORS.danger}
                        />
                    </Pressable>
                </View>
            </View>
        </Pressable>
    );
}

function Chip({
    label,
    icon,
    active,
    onPress,
}: {
    label: string;
    icon: any;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={[s.chip, active && s.chipActive]}
            onPress={onPress}
        >
            <Ionicons
                name={icon}
                size={13}
                color={active ? '#fff' : COLORS.muted}
            />
            <Text style={[s.chipText, active && s.chipTextActive]}>
                {label}
            </Text>
        </Pressable>
    );
}

function AssetDetailModal({
    asset,
    onClose,
    onRefresh,
    showSheet,
    closeSheet,
}: {
    asset: AdminAsset | null;
    onClose: () => void;
    onRefresh: () => void;
    showSheet: (
        title: string,
        actions: SheetAction[],
        message?: string
    ) => void;
    closeSheet: () => void;
}) {
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [replacing, setReplacing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (asset) {
            setLabel(asset.label ?? '');
            setKey(asset.key);
        }
    }, [asset]);

    if (!asset) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.admin.assets.update(asset.id, {
                label: label.trim() || null,
                key: key.trim() || undefined,
            });
            onRefresh();
            onClose();
            showSheet(
                'Berhasil',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                'Metadata aset berhasil diperbarui.'
            );
        } catch (e: any) {
            showSheet(
                'Gagal',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                errMsg(e)
            );
        } finally {
            setSaving(false);
        }
    };

    const handleReplace = async () => {
        try {
            const file = await pickImage();
            if (!file) return;

            setReplacing(true);
            await api.admin.assets.replaceFile(asset.id, {
                uri: file.uri,
                name: file.fileName,
                mimeType: file.mimeType,
            });
            onRefresh();
            onClose();
            showSheet(
                'Berhasil',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                'File berhasil diganti.'
            );
        } catch (e: any) {
            showSheet(
                'Gagal',
                [
                    {
                        label: 'Mengerti',
                        onPress: closeSheet,
                        variant: 'primary',
                    },
                ],
                errMsg(e)
            );
        } finally {
            setReplacing(false);
        }
    };

    return (
        <Modal
            visible={!!asset}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={s.modalOverlay}>
                <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={s.modalSheet}>
                    <View style={s.modalHandle} />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 16 }}
                    >
                        {asset.public_url &&
                            asset.public_url.startsWith('http') ? (
                            <Image
                                source={{ uri: asset.public_url }}
                                style={s.modalImg}
                                resizeMode="contain"
                            />
                        ) : (
                            <View
                                style={[s.modalImg, s.thumbPlaceholder]}
                            >
                                <Ionicons
                                    name="image-outline"
                                    size={48}
                                    color={COLORS.muted}
                                />
                            </View>
                        )}

                        <Text style={s.modalKey} numberOfLines={1}>
                            {asset.key}
                        </Text>

                        <View style={s.infoGrid}>
                            <InfoRow
                                label="Kategori"
                                value={
                                    CATEGORY_LABEL[
                                    asset.category as Category
                                    ] ?? asset.category
                                }
                            />
                            <InfoRow
                                label="Tipe"
                                value={asset.mime_type ?? '-'}
                            />
                            <InfoRow
                                label="Ukuran"
                                value={fmtSize(asset.file_size)}
                            />
                            {!!asset.width && !!asset.height && (
                                <InfoRow
                                    label="Dimensi"
                                    value={`${asset.width}×${asset.height}`}
                                />
                            )}
                            <InfoRow
                                label="Dibuat"
                                value={fmtDate(asset.created_at)}
                            />
                            <InfoRow
                                label="Status"
                                value={
                                    asset.is_active ? 'Aktif' : 'Nonaktif'
                                }
                            />
                        </View>

                        <Text style={s.fieldLabel}>Label</Text>
                        <TextInput
                            style={s.input}
                            value={label}
                            onChangeText={setLabel}
                            placeholder="Nama manusiawi"
                            placeholderTextColor={COLORS.muted}
                        />

                        <Text style={s.fieldLabel}>Key</Text>
                        <TextInput
                            style={s.input}
                            value={key}
                            onChangeText={setKey}
                            placeholder="kunci_unik"
                            placeholderTextColor={COLORS.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={[s.modalBtn, s.modalBtnGhost]}
                                onPress={handleReplace}
                                disabled={replacing}
                            >
                                {replacing ? (
                                    <ActivityIndicator
                                        color={COLORS.primary}
                                    />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="swap-horizontal"
                                            size={16}
                                            color={COLORS.primary}
                                        />
                                        <Text style={s.modalBtnGhostText}>
                                            Ganti File
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.modalBtn, s.modalBtnPrimary]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color="#fff"
                                        />
                                        <Text style={s.modalBtnText}>
                                            Simpan
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.infoRow}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        gap: 10,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.ink,
        letterSpacing: -0.3,
    },
    headerSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

    iconHeaderBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
    },

    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 20,
    },
    uploadBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 13,
    },

    // Search
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 20,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.ink,
        paddingVertical: 0,
    },

    // Toggle aktif
    activeRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    activeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    activeToggleText: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '700',
    },

    // Chips
    chips: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
    },
    chipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
    },
    chipTextActive: { color: '#fff' },

    // List
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    row: { gap: 12, marginBottom: 12 },
    card: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 14,
        overflow: 'hidden',
    },
    thumbWrap: {
        width: '100%',
        backgroundColor: '#eef3f7',
        // aspectRatio di-set dinamis di komponen
    },
    dimBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(18,34,47,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dimBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
    },
    thumb: { width: '100%', height: '100%' },
    inactiveBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(220,38,38,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    inactiveText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    catBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(18,34,47,0.85)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    catBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    cardBody: { padding: 10 },
    cardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.ink,
    },
    cardSub: {
        fontSize: 11,
        color: COLORS.muted,
        marginTop: 2,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    iconBtn: { padding: 4 },

    // Center states
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 10,
    },
    loadingText: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 8,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.ink,
    },
    emptyHint: {
        fontSize: 12,
        color: COLORS.muted,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    retryBtn: {
        marginTop: 10,
        height: 44,
        paddingHorizontal: 24,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#fff', fontWeight: '800' },

    // Detail Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
        maxHeight: '92%',
    },
    thumbPlaceholder: {
        backgroundColor: '#eef3f7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#d5dde5',
        marginBottom: 12,
    },
    modalImg: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        backgroundColor: '#eef3f7',
    },
    modalKey: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.ink,
        marginTop: 14,
    },

    infoGrid: {
        marginTop: 14,
        padding: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    infoLabel: { fontSize: 12, color: COLORS.muted },
    infoValue: {
        flex: 1,
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.ink,
        textAlign: 'right',
    },

    fieldLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.muted,
        marginTop: 16,
        marginBottom: 6,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: COLORS.ink,
        backgroundColor: COLORS.white,
    },

    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    modalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    modalBtnGhost: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.white,
    },
    modalBtnGhostText: {
        color: COLORS.primary,
        fontWeight: '800',
        fontSize: 14,
    },
    modalBtnPrimary: {
        backgroundColor: COLORS.primary,
    },
    modalBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },

    // Upload Progress Modal
    upOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    upCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        gap: 12,
    },
    upIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    upTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.ink,
        textAlign: 'center',
    },
    upFilename: {
        fontSize: 12,
        color: COLORS.muted,
        textAlign: 'center',
        maxWidth: '100%',
    },
    upBarWrap: {
        width: '100%',
        marginTop: 8,
        gap: 6,
    },
    upBarTrack: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e6edf3',
        overflow: 'hidden',
    },
    upBarFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: COLORS.primary,
    },
    upPct: {
        alignSelf: 'flex-end',
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primary,
    },
    upResults: {
        width: '100%',
        marginTop: 6,
        gap: 6,
    },
    upResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    upDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    upResultText: {
        fontSize: 13,
        color: COLORS.ink,
        fontWeight: '700',
    },
    upCloseBtn: {
        marginTop: 10,
        height: 44,
        paddingHorizontal: 32,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    upCloseText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    upHint: {
        fontSize: 11,
        color: COLORS.muted,
        fontStyle: 'italic',
        marginTop: 4,
    },

    // ============================================================
    // ALERT BOTTOM SHEET
    // ============================================================
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        width: '100%',
        position: 'relative',
    },
    sheetCloseButton: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.ink,
        marginBottom: 10,
    },
    sheetDescription: {
        fontSize: 15,
        color: '#555555',
        lineHeight: 22,
        marginBottom: 24,
    },
    sheetAction: {
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
    },
    sheetActionGhost: {
        borderColor: COLORS.primary,
    },
    sheetActionPrimary: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    sheetActionDanger: {
        borderColor: COLORS.danger,
    },
    sheetActionText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.ink,
    },
});