import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';

export default function Drivers() {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        const r = await api.get('/api/admin/users?role=driver');
        setList(r.data ?? []);
        setLoading(false);
    }
    useEffect(() => { load(); }, []);

    async function verify(id: string) {
        await api.put(`/api/admin/drivers/${id}/verify`);
        Alert.alert('Sukses', 'Driver terverifikasi');
        load();
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <View style={s.wrap}>
            <Text style={s.h1}>Drivers ({list.length})</Text>
            <FlatList
                data={list}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.name}>{item.full_name ?? item.email}</Text>
                            <Text style={s.sub}>{item.email}</Text>
                        </View>
                        <Pressable style={s.btn} onPress={() => verify(item.id)}>
                            <Text style={s.btnText}>Verify</Text>
                        </Pressable>
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
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        padding: 16, borderRadius: 10, marginBottom: 10
    },
    name: { fontSize: 16, fontWeight: '600' },
    sub: { color: '#64748b', fontSize: 13 },
    btn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
});