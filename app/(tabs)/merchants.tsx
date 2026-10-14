// app/(tabs)/merchants.tsx
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { api } from '../../lib/api';

export default function Merchants() {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const r = await api.admin.listUsers('merchant');
            setList(Array.isArray(r) ? r : []);
        } catch (e: any) {
            showAlert('Error', e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function showAlert(title: string, message: string) {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    }

    async function verify(id: string) {
        try {
            await api.admin.verifyMerchant(id);
            showAlert('Sukses', 'Merchant terverifikasi');
            load();
        } catch (e: any) {
            showAlert('Gagal', e.message);
        }
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#40a3ea" />;

    return (
        <View style={s.wrap}>
            <Text style={s.h1}>Merchants ({list.length})</Text>
            <FlatList
                data={list}
                keyExtractor={(i) => i.id}
                ListEmptyComponent={
                    <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 40 }}>
                        Belum ada merchant
                    </Text>
                }
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.name}>{item.full_name ?? item.email}</Text>
                            <Text style={s.sub}>{item.email}</Text>
                            {item.is_verified && (
                                <Text style={s.verified}>✓ Terverifikasi</Text>
                            )}
                        </View>
                        {!item.is_verified && (
                            <Pressable style={s.btn} onPress={() => verify(item.id)}>
                                <Text style={s.btnText}>Verify</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const s = StyleSheet.create({
    wrap: { flex: 1, padding: 24, maxWidth: 1000, width: '100%', alignSelf: 'center' },
    h1: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    name: { fontSize: 16, fontWeight: '600', color: '#1f2933' },
    sub: { color: '#64748b', fontSize: 13, marginTop: 2 },
    verified: { color: '#10b981', fontSize: 12, fontWeight: '600', marginTop: 4 },
    btn: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    btnText: { color: '#fff', fontWeight: '700' },
});