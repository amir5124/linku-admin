// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import storage from './storage';

// WebSocket hanya untuk Node (bukan browser). Browser punya WebSocket native.
let realtimeOptions: any = undefined;
if (typeof window === 'undefined' && typeof global !== 'undefined') {
    // Kita di Node (SSR / bundling)
    try {
        const ws = require('ws');
        realtimeOptions = { transport: ws };
    } catch {
        // ws tidak terinstall, skip realtime
    }
}

export const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            storage,                    // ✅ platform-aware
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,  // penting untuk RN/Expo
        },
        realtime: realtimeOptions,    // ✅ fix Node 20 WebSocket
    }
);