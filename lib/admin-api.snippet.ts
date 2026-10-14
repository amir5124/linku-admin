// lib/admin-api.snippet.ts
//
// TEMPEL isi objek di bawah ke dalam objek `admin` di lib/api.ts (di samping `stats`).
// File ini bukan untuk di-import.
//
// ⚠️ `request(path, init)` adalah PERKIRAAN cara lib/api.ts memanggil backend.
//    Samakan dengan fungsi yang dipakai `stats()` / `login()` di file itu
//    (yang menambahkan base URL dan header Authorization dari token).

const qs = (p: Record<string, unknown> = {}) => {
    const q = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
};

const json = (method: string, body?: unknown) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

export const adminEndpoints = {
    // Beranda
    dashboard: () => request('/api/admin/dashboard'),

    // Pesanan
    orders: (p: { status?: string; search?: string; limit?: number; offset?: number }) =>
        request(`/api/admin/orders${qs(p)}`),

    // Mitra
    partners: (p: { type: string; status?: string; search?: string; limit?: number; offset?: number }) =>
        request(`/api/admin/partners${qs(p)}`),
    verifyMerchant: (id: string) => request(`/api/admin/merchants/${id}/verify`, json('PUT')),
    verifyDriver: (id: string) => request(`/api/admin/drivers/${id}/verify`, json('PUT')),
    suspendPartner: (id: string, suspended: boolean) =>
        request(`/api/admin/partners/${id}/suspend`, json('PUT', { suspended })),

    // Keuangan
    financeSummary: () => request('/api/admin/finance/summary'),
    withdrawals: (p: { source?: string; status?: string; limit?: number; offset?: number }) =>
        request(`/api/admin/finance/withdrawals${qs(p)}`),
    approvePayout: (id: string | number) =>
        request(`/api/admin/finance/payouts/${id}/approve`, json('PUT')),
    rejectPayout: (id: string | number, reason?: string) =>
        request(`/api/admin/finance/payouts/${id}/reject`, json('PUT', { reason })),
    topups: (p: { status?: string; limit?: number; offset?: number }) =>
        request(`/api/admin/finance/topups${qs(p)}`),
    commissions: (p: { limit?: number; offset?: number }) =>
        request(`/api/admin/finance/commissions${qs(p)}`),

    // Akun
    admins: () => request('/api/admin/admins'),
    auditLogs: (p: { limit?: number; offset?: number }) => request(`/api/admin/audit-logs${qs(p)}`),
};

declare function request(path: string, init?: unknown): Promise<any>;