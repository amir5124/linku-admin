// lib/storage.ts
import { Platform } from 'react-native';

// Tipe minimal yang dibutuhkan Supabase
type StorageLike = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

let storage: StorageLike;

if (Platform.OS === 'web') {
    // Web: pakai localStorage browser (tersedia di client, aman)
    storage = {
        getItem: async (key) => {
            if (typeof window === 'undefined') return null; // SSR guard
            return window.localStorage.getItem(key);
        },
        setItem: async (key, value) => {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem(key, value);
        },
        removeItem: async (key) => {
            if (typeof window === 'undefined') return;
            window.localStorage.removeItem(key);
        },
    };
} else {
    // Native: pakai AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    storage = AsyncStorage;
}

export default storage;