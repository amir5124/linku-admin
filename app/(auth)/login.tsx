// app/(auth)/login.tsx — Login Admin Waruung (desain baru)
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, clearToken, saveToken } from '../../lib/api';

const COLORS = {
    primary: '#1477b8',
    ink: '#12222f',
    muted: '#5b6b7b',
    placeholder: '#7b8794',
    border: '#cfd9e3',
    surface: '#f4f7fa',
    white: '#ffffff',
};

export default function AdminLoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const passwordRef = useRef<TextInput>(null);

    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const showErrorModal = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(() => setErrorModalVisible(true), Platform.OS === 'ios' ? 400 : 0);
    };

    const handleForgot = () =>
        showErrorModal(
            'Lupa kata sandi?',
            'Hubungi super admin Waruung untuk mengatur ulang kata sandi akun admin.'
        );

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) {
            showErrorModal('Data belum lengkap', 'Email dan kata sandi wajib diisi.');
            return;
        }

        setLoading(true);
        console.log('[ADMIN LOGIN] Mulai untuk:', email.trim().toLowerCase());

        try {
            // 1. Login ke backend
            const res = await api.login({
                email: email.trim().toLowerCase(),
                password,
            });

            console.log('[ADMIN LOGIN] Response:', {
                userId: res.userId,
                role: res.role,
                tokenLength: res.token?.length,
            });

            // 2. Simpan token DULU supaya api.me() bisa pakai
            await saveToken(res.token);

            // 3. Ambil profil lengkap
            const profile = await api.me();
            console.log('[ADMIN LOGIN] Profil:', {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                role: profile.role,
            });

            // 4. GUARD: pastikan role = admin
            if (profile.role !== 'admin') {
                await clearToken();
                await AsyncStorage.removeItem('profile');
                showErrorModal(
                    'Akses Ditolak',
                    'Akun ini bukan admin. Silakan gunakan aplikasi yang sesuai.'
                );
                return;
            }

            // 5. Simpan profil admin ke cache
            await AsyncStorage.setItem('profile', JSON.stringify(profile));

            console.log('[ADMIN LOGIN] Sukses, redirect ke dashboard');
            router.replace('/(tabs)' as any);
        } catch (err: any) {
            console.error('[ADMIN LOGIN] Gagal:', err.message);
            await clearToken();
            showErrorModal('Login Gagal', err.message || 'Periksa email dan kata sandi Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Logo + judul ── */}
                    <View style={styles.logo}>
                        <Ionicons name="storefront-outline" size={28} color="#ffffff" />
                    </View>

                    <Text style={styles.title}>Waruung Admin</Text>
                    <Text style={styles.subtitle}>
                        Masuk untuk mengelola mitra, pesanan, dan keuangan platform.
                    </Text>

                    {/* ── Email ── */}
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, { marginBottom: 16 }]}
                        placeholder="nama@email.com"
                        placeholderTextColor={COLORS.placeholder}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        value={email}
                        onChangeText={setEmail}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        editable={!loading}
                    />

                    {/* ── Kata sandi ── */}
                    <Text style={styles.label}>Kata sandi</Text>
                    <View style={styles.passwordWrapper}>
                        <TextInput
                            ref={passwordRef}
                            style={styles.passwordInput}
                            placeholder="Masukkan kata sandi"
                            placeholderTextColor={COLORS.placeholder}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            returnKeyType="go"
                            value={password}
                            onChangeText={setPassword}
                            onSubmitEditing={handleSignIn}
                            editable={!loading}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword((v) => !v)}
                            hitSlop={10}
                            accessibilityLabel={
                                showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                            }
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={22}
                                color={COLORS.muted}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.forgot}
                        onPress={handleForgot}
                        accessibilityRole="link"
                    >
                        <Text style={styles.forgotText}>Lupa kata sandi?</Text>
                    </TouchableOpacity>

                    {/* ── Tombol masuk ── */}
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                        activeOpacity={0.85}
                        onPress={handleSignIn}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>Masuk</Text>
                    </TouchableOpacity>

                    {/* ── Info keamanan ── */}
                    <View style={styles.noticeRow}>
                        <Ionicons name="lock-closed-outline" size={14} color={COLORS.muted} />
                        <Text style={styles.noticeText}>
                            Semua aktivitas admin dicatat untuk keamanan
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── MODAL LOADING ── */}
            <Modal animationType="fade" transparent visible={loading} onRequestClose={() => { }}>
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Memverifikasi...</Text>
                    </View>
                </View>
            </Modal>

            {/* ── ALERT BOTTOM SHEET ── */}
            <Modal
                visible={errorModalVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <View style={styles.sheetOverlay}>
                    <TouchableWithoutFeedback onPress={() => setErrorModalVisible(false)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={styles.sheetContainer}>
                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetCloseButton}
                            accessibilityLabel="Tutup"
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>

                        <Text style={styles.sheetTitle}>{errorTitle}</Text>
                        <Text style={styles.sheetDescription}>{errorMessage}</Text>

                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetButton}
                        >
                            <Text style={styles.sheetButtonText}>Mengerti</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    // Konten di tengah layar, tetap bisa scroll saat keyboard muncul
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },

    logo: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        marginTop: 24,
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: -0.5,
        color: COLORS.ink,
    },
    subtitle: {
        marginTop: 8,
        marginBottom: 28,
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.muted,
    },

    label: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
    input: {
        height: 52,
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 15,
        color: COLORS.ink,
    },
    passwordWrapper: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        gap: 10,
    },
    passwordInput: { flex: 1, fontSize: 15, color: COLORS.ink, paddingVertical: 0 },

    forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
    forgotText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

    primaryButton: {
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },

    noticeRow: {
        marginTop: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    noticeText: { fontSize: 12, color: COLORS.muted },

    // ── Loading Modal ──
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 120,
        paddingVertical: 24,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    loadingText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },

    // ── Bottom Sheet ──
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
    sheetTitle: { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
    sheetDescription: { fontSize: 15, color: '#555555', lineHeight: 22, marginBottom: 32 },
    sheetButton: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    sheetButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
});