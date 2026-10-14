// lib/imagePicker.ts
// Wrapper universal untuk picker gambar:
// - Web: pakai <input type="file"> (expo-image-picker tidak jalan di browser)
// - Native (Android/iOS): pakai expo-image-picker

import { Platform } from 'react-native';

// ============================================================
// TYPES
// ============================================================
export type PickedImage = {
    uri: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
};

const isWeb = Platform.OS === 'web';

// ============================================================
// CONSTANTS
// ============================================================
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIMES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml',
    'image/gif',
];
const ACCEPTED_ATTR = ACCEPTED_MIMES.join(',');

// ============================================================
// WEB — pakai <input type="file">
// ============================================================
function pickWeb(multiple = false): Promise<PickedImage[]> {
    return new Promise((resolve) => {
        console.log('🟡 [picker] pickWeb START, multiple:', multiple);

        if (typeof document === 'undefined') {
            console.warn('[picker] document tidak tersedia (SSR?)');
            resolve([]);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = ACCEPTED_ATTR;
        input.multiple = multiple;
        input.style.display = 'none';
        input.style.position = 'fixed';
        input.style.top = '-9999px';
        input.style.left = '-9999px';

        let resolved = false;
        const finish = (results: PickedImage[]) => {
            if (resolved) return;
            resolved = true;
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            console.log('🟡 [picker] finish() with', results.length, 'file(s)');
            resolve(results);
        };

        input.onchange = async () => {
            console.log('🟡 [picker] ✅ onchange FIRED');
            const files = Array.from(input.files ?? []);
            console.log('🟡 [picker] files.length:', files.length);

            if (files.length === 0) {
                finish([]);
                return;
            }

            const results: PickedImage[] = [];

            for (const file of files) {
                console.log(
                    '🟡 [picker] processing:',
                    file.name,
                    file.size,
                    file.type
                );

                if (!ACCEPTED_MIMES.includes(file.type)) {
                    console.warn(
                        `[picker] ${file.name}: tipe ${file.type} tidak didukung`
                    );
                    continue;
                }

                if (file.size > MAX_FILE_SIZE) {
                    console.warn(
                        `[picker] ${file.name}: terlalu besar`
                    );
                    continue;
                }

                const uri = await fileToDataUrl(file);
                if (!uri) continue;

                results.push({
                    uri,
                    fileName: file.name || `upload_${Date.now()}.jpg`,
                    mimeType: file.type || 'image/jpeg',
                    fileSize: file.size,
                });
            }

            finish(results);
        };

        // ✅ HANYA oncancel — TIDAK ada window.addEventListener('focus')
        (input as any).oncancel = () => {
            console.log('🔴 [picker] user CANCEL via oncancel');
            finish([]);
        };

        console.log('🟡 [picker] appending & clicking...');
        document.body.appendChild(input);
        input.click();
        console.log('🟡 [picker] input.click() DONE');
    });
}

/** Convert File → data URL */
function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            console.log('🟡 [picker] FileReader done');
            resolve((reader.result as string) ?? '');
        };
        reader.onerror = () => {
            console.warn(`[picker] gagal baca ${file.name}`);
            resolve('');
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
// NATIVE — pakai expo-image-picker (dynamic import)
// ============================================================
async function pickNative(
    multiple = false,
    max = 20
): Promise<PickedImage[]> {
    const ImagePicker = await import('expo-image-picker');

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
        throw new Error(
            'Izin galeri ditolak. Aktifkan di pengaturan aplikasi.'
        );
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: multiple,
        selectionLimit: multiple ? max : 1,
    });

    if (result.canceled || !result.assets?.length) return [];

    const out: PickedImage[] = [];
    for (const a of result.assets) {
        if (a.fileSize && a.fileSize > MAX_FILE_SIZE) {
            console.warn(`[picker] ${a.fileName ?? a.uri}: > 5 MB, di-skip`);
            continue;
        }

        out.push({
            uri: a.uri,
            fileName:
                a.fileName ??
                a.uri.split('/').pop() ??
                `upload_${Date.now()}.jpg`,
            mimeType: a.mimeType ?? guessMimeFromUri(a.uri),
            fileSize: a.fileSize ?? 0,
        });
    }

    return out;
}

function guessMimeFromUri(uri: string): string {
    const ext = uri.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'svg':
            return 'image/svg+xml';
        case 'gif':
            return 'image/gif';
        case 'jpg':
        case 'jpeg':
        default:
            return 'image/jpeg';
    }
}

// ============================================================
// PUBLIC API
// ============================================================
export async function pickImage(): Promise<PickedImage | null> {
    console.log('🟡 [picker] pickImage() DIPANGGIL, isWeb =', isWeb);
    try {
        const results = isWeb
            ? await pickWeb(false)
            : await pickNative(false);
        console.log('🟡 [picker] pickImage results:', results.length);
        return results[0] ?? null;
    } catch (e) {
        console.error('[picker] pickImage gagal:', e);
        return null;
    }
}

export async function pickImages(max = 20): Promise<PickedImage[]> {
    console.log('🟡 [picker] pickImages() DIPANGGIL, isWeb =', isWeb);
    try {
        const results = isWeb
            ? await pickWeb(true)
            : await pickNative(true, max);
        return results.slice(0, max);
    } catch (e) {
        console.error('[picker] pickImages gagal:', e);
        return [];
    }
}

// ============================================================
// UTILITIES
// ============================================================
export const isPickerAvailable = () => {
    if (isWeb) return typeof document !== 'undefined';
    return true;
};

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}

export function isDataUrl(uri: string): boolean {
    return typeof uri === 'string' && uri.startsWith('data:');
}

export async function appendFileToFormData(
    formData: FormData,
    fieldName: string,
    file: { uri: string; name: string; mimeType: string }
): Promise<void> {
    if (isWeb && isDataUrl(file.uri)) {
        const blob = await dataUrlToBlob(file.uri);
        formData.append(fieldName, blob, file.name);
        console.log('[picker] appended as Blob:', file.name, blob.size);
    } else {
        formData.append(fieldName, {
            uri: file.uri,
            name: file.name,
            type: file.mimeType,
        } as any);
        console.log('[picker] appended as RN file:', file.name);
    }
}

export default {
    pickImage,
    pickImages,
    isPickerAvailable,
    dataUrlToBlob,
    isDataUrl,
    appendFileToFormData,
};