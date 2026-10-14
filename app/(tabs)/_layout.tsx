// app/(tabs)/_layout.tsx — Tab admin Waruung
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
    primary: '#1477b8',
    muted: '#5b6b7b',
    white: '#ffffff',
    line: '#e1e8ef',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
    return ({ color, focused }: { color: string; focused: boolean }) => (
        <Ionicons name={focused ? active : inactive} size={24} color={color} />
    );
}

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const bottom = Math.max(insets.bottom, 8);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.muted,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                tabBarStyle: {
                    backgroundColor: COLORS.white,
                    borderTopColor: COLORS.line,
                    borderTopWidth: 1,
                    height: 60 + bottom,
                    paddingTop: 8,
                    paddingBottom: bottom,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: 'Beranda', tabBarIcon: tabIcon('home', 'home-outline') }}
            />
            <Tabs.Screen
                name="orders"
                options={{ title: 'Pesanan', tabBarIcon: tabIcon('receipt', 'receipt-outline') }}
            />
            <Tabs.Screen
                name="mitra"
                options={{ title: 'Mitra', tabBarIcon: tabIcon('storefront', 'storefront-outline') }}
            />
            <Tabs.Screen
                name="keuangan"
                options={{ title: 'Keuangan', tabBarIcon: tabIcon('wallet', 'wallet-outline') }}
            />

            {/* ✅ TAB BARU: Assets — kelola banner, icon, marker map, splash */}
            <Tabs.Screen
                name="asset"
                options={{
                    title: 'Aset',
                    tabBarIcon: tabIcon('images', 'images-outline'),
                }}
            />

            <Tabs.Screen
                name="akun"
                options={{ title: 'Akun', tabBarIcon: tabIcon('person', 'person-outline') }}
            />

            {/* Driver & merchant digabung di tab Mitra (segmen Merchant / Driver),
                jadi tab lamanya disembunyikan dari tab bar */}
            <Tabs.Screen name="drivers" options={{ href: null }} />
            <Tabs.Screen name="merchants" options={{ href: null }} />
        </Tabs>
    );
}