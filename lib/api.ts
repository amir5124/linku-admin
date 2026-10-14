// lib/api.ts
// API client untuk Admin Waruung — Web + Android + iOS
// Semua request ke backend Express di /api/*
// ============================================================

import { Platform } from 'react-native';
import { appendFileToFormData } from './imagePicker';

// ============================================================
// 1. STORAGE — Web: localStorage, Native: AsyncStorage
// ============================================================
const isWeb = Platform.OS === 'web';

async function storageGet(key: string): Promise<string | null> {
    if (isWeb) {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return AsyncStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
    if (isWeb) {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
        return;
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(key, value);
}

async function storageRemove(key: string): Promise<void> {
    if (isWeb) {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(key);
        return;
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem(key);
}

// ============================================================
// 2. CONFIG
// ============================================================
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const TOKEN_KEY = 'admin_token';
const PROFILE_KEY = 'admin_profile';

console.log('[api] BASE:', BASE, '| Platform:', Platform.OS);

// ============================================================
// 3. TOKEN HELPERS
// ============================================================
export async function saveToken(token: string): Promise<void> {
    await storageSet(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
    return storageGet(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
    await storageRemove(TOKEN_KEY);
    await storageRemove(PROFILE_KEY);
}

export async function saveProfile(profile: any): Promise<void> {
    await storageSet(PROFILE_KEY, JSON.stringify(profile));
}

export async function getProfile(): Promise<any | null> {
    const raw = await storageGet(PROFILE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// ============================================================
// 4. 401 HANDLER (auto logout)
// ============================================================
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn;
}

async function handleUnauthorized() {
    await clearToken();
    if (onUnauthorized) {
        onUnauthorized();
        return;
    }
    try {
        const { router } = await import('expo-router');
        router.replace('/(auth)/login' as any);
    } catch {
        /* abaikan */
    }
}

// ============================================================
// 5. ERROR TYPE
// ============================================================
export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

// ============================================================
// 6. CORE REQUEST — JSON
// ============================================================
interface RequestOptions extends RequestInit {
    /** Set false untuk skip auto-attach Authorization (mis. login) */
    skipAuth?: boolean;
}

async function request<T = any>(
    path: string,
    options: RequestOptions = {}
): Promise<T> {
    const { skipAuth, ...init } = options;

    const token = skipAuth ? null : await getToken();
    const url = `${BASE}${path}`;

    const method = init.method ?? 'GET';
    console.log(`[api] ${method} ${url}${token ? ' 🔑' : ''}`);

    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(init.headers || {}),
            },
        });
    } catch (e: any) {
        console.warn('[api] Network error:', e?.message);
        throw new ApiError(
            0,
            'Tidak bisa terhubung ke server. Cek koneksi internet.'
        );
    }

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new ApiError(res.status, `Server error (${res.status})`);
    }

    if (res.status === 401 && !path.endsWith('/auth/login')) {
        await handleUnauthorized();
        throw new ApiError(401, 'Sesi habis, silakan login ulang.');
    }

    if (!res.ok || json?.success === false) {
        const msg = json?.message || `Request gagal (${res.status})`;
        throw new ApiError(res.status, msg);
    }

    return (json?.data ?? json) as T;
}

// ============================================================
// 6b. CORE REQUEST — MULTIPART (untuk upload file)
// ============================================================
/**
 * Upload multipart/form-data.
 * ⚠️ JANGAN set Content-Type manual — fetch akan auto-set boundary.
 */
async function uploadMultipart<T = any>(
    path: string,
    formData: FormData,
    method: 'POST' | 'PUT' = 'POST'
): Promise<T> {
    const token = await getToken();
    const url = `${BASE}${path}`;

    console.log(`[api] ${method} ${url} (multipart)${token ? ' 🔑' : ''}`);

    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                // ⚠️ Jangan set Content-Type
            },
            body: formData,
        });
    } catch (e: any) {
        console.warn('[api] Network error (multipart):', e?.message);
        throw new ApiError(
            0,
            'Tidak bisa terhubung ke server. Cek koneksi internet.'
        );
    }

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new ApiError(res.status, `Server error (${res.status})`);
    }

    if (res.status === 401) {
        await handleUnauthorized();
        throw new ApiError(401, 'Sesi habis, silakan login ulang.');
    }

    if (!res.ok || json?.success === false) {
        const msg = json?.message || `Upload gagal (${res.status})`;
        throw new ApiError(res.status, msg);
    }

    return (json?.data ?? json) as T;
}

// ============================================================
// 7. TYPES — Response Backend
// ============================================================
export interface AuthResponse {
    token: string;
    userId: string;
    role: string;
}

export interface ProfileResponse {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: string;
    avatar_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
    rating_avg?: number | null;
    total_orders?: number;
    total_reviews?: number;
}

export interface StatsResponse {
    users: number;
    drivers: number;
    merchants: number;
    orders: number;
}

export interface DashboardResponse {
    orders_today: number;
    commission_today: number;
    commission_total: number;
    active_partners: number;
    pending_verification: {
        merchants: number;
        drivers: number;
        total: number;
    };
    pending_withdrawals: number;
    orders_last_7_days: Array<{ date: string; count: number }>;
}

// ── Pesanan ──
export type OrderStatusGroup =
    | 'diproses'
    | 'diantar'
    | 'selesai'
    | 'batal'
    | 'semua';

export interface OrderListItem {
    id: number | string;
    order_code: string;
    service: string;
    status: OrderStatusGroup | 'lainnya';
    raw_status: string;
    total: number;
    payment_method: string | null;
    settlement_type: string | null;
    merchant_name: string | null;
    driver_name: string | null;
    customer_name: string | null;
    dropoff_name: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface OrdersResponse {
    items: OrderListItem[];
    total: number;
}

// ── Mitra ──
export type PartnerType = 'merchant' | 'driver';
export type PartnerStatus = 'all' | 'active' | 'pending' | 'suspended';

export interface PartnerListItem {
    user_id: string;
    name: string;
    owner_name: string | null;
    phone: string | null;
    address: string | null;
    is_verified: boolean;
    is_suspended: boolean;
    status: 'active' | 'pending' | 'suspended';
    is_open: boolean | null;
    rating_avg: number | null;
    total_orders: number | null;
    created_at: string | null;
}

export interface PartnersResponse {
    items: PartnerListItem[];
    total: number;
    counts: {
        all: number;
        active: number;
        pending: number;
        suspended: number;
    };
}

// ── Keuangan ──
export type WithdrawalSource = 'linkqu' | 'payout';
export type WithdrawalStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'success'
    | 'failed'
    | 'all';

export interface WithdrawalItem {
    id: number | string;
    source: WithdrawalSource;
    user_id: string;
    name: string;
    role: string | null;
    amount: number;
    fee_admin: number;
    status: Exclude<WithdrawalStatus, 'all'>;
    raw_status: string;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    cash_debt: number;
    created_at: string;
}

export interface WithdrawalsResponse {
    items: WithdrawalItem[];
    total: number;
}

export interface TopupItem {
    id: number | string;
    user_id: string;
    name: string;
    role: string | null;
    amount: number;
    total_paid: number;
    admin_fee: number;
    method: string | null;
    status: 'pending' | 'success' | 'failed';
    raw_status: string;
    created_at: string;
}

export interface TopupsResponse {
    items: TopupItem[];
    total: number;
}

export interface FinanceSummaryResponse {
    pending_withdrawals: {
        count: number;
        total: number;
        linkqu?: { count: number; total: number };
        payouts?: { count: number; total: number };
    };
}

export interface CommissionItem {
    id: number | string;
    order_code: string;
    service: string;
    settlement_type: string | null;
    commission: number;
    completed_at: string | null;
}

export interface CommissionsResponse {
    items: CommissionItem[];
    total: number;
    total_commission: number;
}

// ── Akun ──
export interface AdminItem {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    created_at: string;
}

export interface AuditLogItem {
    id: number | string;
    admin_id: string | null;
    admin_name: string | null;
    action: string;
    target_type: string;
    target_id: string;
    meta: Record<string, any>;
    created_at: string;
}

export interface AuditLogsResponse {
    items: AuditLogItem[];
    total: number;
}

// ── Tarif & pengaturan ──
export interface Tariff {
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
}

export type TariffInput = Partial<Omit<Tariff, 'code'>>;

export interface TariffCalcResult {
    code?: string;
    label?: string;
    price?: number;
    [key: string]: any;
}

export type SettingValueType = 'number' | 'boolean' | 'string' | 'json';

export interface AppSetting {
    key: string;
    value: string;
    value_type: SettingValueType;
    category?: string | null;
    is_public?: boolean | null;
    updated_by?: string | null;
    updated_at?: string | null;
}

export interface SettingCreateInput {
    key: string;
    value: string | number | boolean;
    value_type?: SettingValueType;
    category?: string;
    is_public?: boolean;
}

export interface SettingUpdateInput {
    value?: string | number | boolean;
    value_type?: SettingValueType;
    category?: string;
    is_public?: boolean;
}

export type CommissionOrderType = 'ride' | 'send' | 'food';

export interface CommissionRate {
    order_type: CommissionOrderType | string;
    tariff_code: string | null;
    rate: number | string;
    is_active: boolean;
}

// ── Assets ──
export type AdminAssetCategory =
    | 'banner'
    | 'icon'
    | 'marker'
    | 'splash'
    | 'other';

export interface AdminAsset {
    id: number;
    key: string;
    category: AdminAssetCategory;
    file_path: string;
    public_url: string;
    mime_type: string | null;
    file_size: number | null;
    width: number | null;
    height: number | null;
    label: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface AdminAssetsListResponse {
    items: AdminAsset[];
    total: number;
    limit: number;
    offset: number;
}

export interface AdminAssetsStats {
    total: number;
    active: number;
    inactive: number;
    total_size: number;
    by_category: Record<string, { count: number; size: number }>;
}

export interface AdminAssetsBulkResult {
    total: number;
    success: number;
    failed: number;
    results: Array<
        | { ok: true; asset: AdminAsset }
        | { ok: false; filename: string; error: string }
    >;
}

// ============================================================
// 8. QUERY STRING HELPER
// ============================================================
function qs(
    params?: Record<string, string | number | boolean | undefined | null>
): string {
    if (!params) return '';
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            search.append(k, String(v));
        }
    });
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ============================================================
// 9. API OBJECT
// ============================================================
export const api = {
    // ────────────────────────────────────────────────────────
    // AUTH
    // ────────────────────────────────────────────────────────
    login: (body: { email: string; password: string }) =>
        request<AuthResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(body),
            skipAuth: true,
        }),

    me: () => request<ProfileResponse>('/api/auth/me'),

    // ────────────────────────────────────────────────────────
    // GENERIC
    // ────────────────────────────────────────────────────────
    get: <T = any>(path: string) => request<T>(path),

    put: <T = any>(path: string, body?: any) =>
        request<T>(path, {
            method: 'PUT',
            body: JSON.stringify(body ?? {}),
        }),

    post: <T = any>(path: string, body?: any) =>
        request<T>(path, {
            method: 'POST',
            body: JSON.stringify(body ?? {}),
        }),

    delete: <T = any>(path: string) =>
        request<T>(path, { method: 'DELETE' }),

    // ────────────────────────────────────────────────────────
    // ADMIN
    // ────────────────────────────────────────────────────────
    admin: {
        // ── Beranda ──
        stats: () => request<StatsResponse>('/api/admin/stats'),
        dashboard: () =>
            request<DashboardResponse>('/api/admin/dashboard'),

        // ── Pesanan ──
        orders: (params?: {
            status?: OrderStatusGroup | string;
            search?: string;
            limit?: number;
            offset?: number;
        }) =>
            request<OrdersResponse>(
                `/api/admin/orders${qs({
                    status:
                        params?.status && params.status !== 'semua'
                            ? params.status
                            : undefined,
                    search: params?.search,
                    limit: params?.limit,
                    offset: params?.offset,
                })}`
            ),

        order: (id: string | number) =>
            request<OrderListItem & { raw: any }>(
                `/api/admin/orders/${id}`
            ),

        // ── Mitra ──
        users: (role?: string) =>
            request<ProfileResponse[]>(
                `/api/admin/users${qs({ role })}`
            ),

        partners: (params: {
            type: PartnerType | string;
            status?: PartnerStatus | string;
            search?: string;
            limit?: number;
            offset?: number;
        }) =>
            request<PartnersResponse>(
                `/api/admin/partners${qs({
                    type: params.type,
                    status: params.status,
                    search: params.search,
                    limit: params.limit,
                    offset: params.offset,
                })}`
            ),

        suspendPartner: (id: string, suspended: boolean) =>
            request<null>(`/api/admin/partners/${id}/suspend`, {
                method: 'PUT',
                body: JSON.stringify({ suspended }),
            }),

        verifyDriver: (id: string) =>
            request<null>(`/api/admin/drivers/${id}/verify`, {
                method: 'PUT',
            }),

        verifyMerchant: (id: string) =>
            request<null>(`/api/admin/merchants/${id}/verify`, {
                method: 'PUT',
            }),

        // ── Keuangan ──
        financeSummary: () =>
            request<FinanceSummaryResponse>(
                '/api/admin/finance/summary'
            ),

        withdrawals: (params?: {
            source?: WithdrawalSource | string;
            status?: WithdrawalStatus | string;
            limit?: number;
            offset?: number;
        }) =>
            request<WithdrawalsResponse>(
                `/api/admin/finance/withdrawals${qs({
                    source: params?.source,
                    status: params?.status,
                    limit: params?.limit,
                    offset: params?.offset,
                })}`
            ),

        approvePayout: (id: string | number) =>
            request<null>(
                `/api/admin/finance/payouts/${id}/approve`,
                { method: 'PUT' }
            ),

        rejectPayout: (id: string | number, reason?: string) =>
            request<null>(
                `/api/admin/finance/payouts/${id}/reject`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ reason }),
                }
            ),

        topups: (params?: {
            status?: string;
            limit?: number;
            offset?: number;
        }) =>
            request<TopupsResponse>(
                `/api/admin/finance/topups${qs({
                    status: params?.status,
                    limit: params?.limit,
                    offset: params?.offset,
                })}`
            ),

        commissions: (params?: { limit?: number; offset?: number }) =>
            request<CommissionsResponse>(
                `/api/admin/finance/commissions${qs({
                    limit: params?.limit,
                    offset: params?.offset,
                })}`
            ),

        // ── Tarif ──
        tariffs: () => request<Tariff[]>('/api/tariffs/admin/all'),

        createTariff: (body: TariffInput & { code: string }) =>
            request<Tariff>('/api/tariffs/admin', {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateTariff: (code: string, body: TariffInput) =>
            request<Tariff>(
                `/api/tariffs/admin/${encodeURIComponent(code)}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(body),
                }
            ),

        deleteTariff: (code: string) =>
            request<null>(
                `/api/tariffs/admin/${encodeURIComponent(code)}`,
                { method: 'DELETE' }
            ),

        calculateTariff: (code: string, distanceKm: number) =>
            request<TariffCalcResult>(
                `/api/tariffs/calculate${qs({
                    code,
                    distance_km: distanceKm,
                })}`
            ),

        // ── Pengaturan aplikasi ──
        settings: () => request<AppSetting[]>('/api/admin/settings'),

        createSetting: (body: SettingCreateInput) =>
            request<AppSetting>('/api/admin/settings', {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateSetting: (key: string, body: SettingUpdateInput) =>
            request<AppSetting>(
                `/api/admin/settings/${encodeURIComponent(key)}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(body),
                }
            ),

        deleteSetting: (key: string) =>
            request<null>(
                `/api/admin/settings/${encodeURIComponent(key)}`,
                { method: 'DELETE' }
            ),

        // ── Komisi per jenis order ──
        commissionRates: () =>
            request<CommissionRate[]>('/api/admin/commission-rates'),

        createCommissionRate: (body: {
            order_type: string;
            tariff_code?: string | null;
            rate: number;
            is_active?: boolean;
        }) =>
            request<CommissionRate>('/api/admin/commission-rates', {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateCommissionRate: (
            orderType: string,
            tariffCode: string | null,
            body: { rate?: number; is_active?: boolean }
        ) =>
            request<CommissionRate>(
                `/api/admin/commission-rates/${encodeURIComponent(
                    orderType
                )}/${encodeURIComponent(tariffCode ?? '_default')}`,
                { method: 'PUT', body: JSON.stringify(body) }
            ),

        deleteCommissionRate: (
            orderType: string,
            tariffCode: string | null
        ) =>
            request<null>(
                `/api/admin/commission-rates/${encodeURIComponent(
                    orderType
                )}/${encodeURIComponent(tariffCode ?? '_default')}`,
                { method: 'DELETE' }
            ),

        // ── Akun ──
        admins: () => request<AdminItem[]>('/api/admin/admins'),

        auditLogs: (params?: { limit?: number; offset?: number }) =>
            request<AuditLogsResponse>(
                `/api/admin/audit-logs${qs({
                    limit: params?.limit,
                    offset: params?.offset,
                })}`
            ),

        // ────────────────────────────────────────────────────
        // ASSETS (banner, icon, marker, splash)
        // ────────────────────────────────────────────────────
        // ────────────────────────────────────────────────────
        // ASSETS (banner, icon, marker, splash)
        // ────────────────────────────────────────────────────
        assets: {
            /** List assets dengan filter */
            list: (opts?: {
                category?: AdminAssetCategory | string;
                search?: string;
                active_only?: boolean;
                limit?: number;
                offset?: number;
            }) =>
                request<AdminAssetsListResponse>(
                    `/api/admin/assets${qs({
                        category: opts?.category,
                        search: opts?.search,
                        active_only: opts?.active_only ? 'true' : undefined,
                        limit: opts?.limit,
                        offset: opts?.offset,
                    })}`
                ),

            /** Detail 1 asset */
            getById: (id: number) =>
                request<AdminAsset>(`/api/admin/assets/${id}`),

            /** Statistik asset */
            stats: () =>
                request<AdminAssetsStats>('/api/admin/assets/stats'),

            /** Upload 1 file (multipart) */
            upload: async (input: {
                uri: string;
                name: string;
                mimeType: string;
                category: AdminAssetCategory;
                key?: string;
                label?: string;
                width?: number;
                height?: number;
            }) => {
                console.log('🟢 [api] assets.upload START:', {
                    name: input.name,
                    category: input.category,
                    mimeType: input.mimeType,
                    uriPrefix: input.uri.substring(0, 40),
                });

                const formData = new FormData();

                // ✅ GUNAKAN HELPER — convert ke Blob untuk web, object untuk native
                await appendFileToFormData(formData, 'file', {
                    uri: input.uri,
                    name: input.name,
                    mimeType: input.mimeType,
                });

                formData.append('category', input.category);
                if (input.key) formData.append('key', input.key);
                if (input.label) formData.append('label', input.label);
                if (input.width)
                    formData.append('width', String(input.width));
                if (input.height)
                    formData.append('height', String(input.height));

                // Debug: cek isi FormData
                try {
                    const parts = (formData as any)._parts ?? [];
                    console.log(
                        '🟢 [api] FormData keys:',
                        parts.map((p: any) => p[0])
                    );
                } catch { }

                return uploadMultipart<AdminAsset>(
                    '/api/admin/assets',
                    formData
                );
            },

            /** Upload banyak file sekaligus (multipart) */
            bulkUpload: async (input: {
                files: Array<{
                    uri: string;
                    name: string;
                    mimeType: string;
                }>;
                category: AdminAssetCategory;
            }) => {
                const formData = new FormData();

                for (const f of input.files) {
                    await appendFileToFormData(formData, 'files', {
                        uri: f.uri,
                        name: f.name,
                        mimeType: f.mimeType,
                    });
                }
                formData.append('category', input.category);

                return uploadMultipart<AdminAssetsBulkResult>(
                    '/api/admin/assets/bulk',
                    formData
                );
            },

            /** Update metadata */
            update: (
                id: number,
                patch: {
                    label?: string | null;
                    is_active?: boolean;
                    key?: string;
                }
            ) =>
                request<AdminAsset>(`/api/admin/assets/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(patch),
                }),

            /** Ganti file (multipart) */
            replaceFile: async (
                id: number,
                file: { uri: string; name: string; mimeType: string }
            ) => {
                const formData = new FormData();

                // ✅ GUNAKAN HELPER juga
                await appendFileToFormData(formData, 'file', {
                    uri: file.uri,
                    name: file.name,
                    mimeType: file.mimeType,
                });

                return uploadMultipart<AdminAsset>(
                    `/api/admin/assets/${id}/replace`,
                    formData,
                    'PUT'
                );
            },

            /** Hapus (soft default, hard=true untuk permanen) */
            remove: (id: number, hard = false) =>
                request<null>(
                    `/api/admin/assets/${id}${hard ? '?hard=true' : ''}`,
                    { method: 'DELETE' }
                ),
        },
    },
};

// ============================================================
// 10. DEFAULT EXPORT
// ============================================================
export default api;