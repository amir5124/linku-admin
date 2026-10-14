// app/driver/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function DriverDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();

    return (
        <View style={s.wrap}>
            <Text style={s.title}>Detail Driver</Text>
            <Text style={s.sub}>ID: {id}</Text>
            <Text style={s.note}>Halaman detail driver — coming soon</Text>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
    sub: { color: '#64748b', marginBottom: 24 },
    note: { color: '#94a3b8', fontSize: 13 },
});