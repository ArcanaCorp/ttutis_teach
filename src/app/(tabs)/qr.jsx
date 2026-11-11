import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { Camera, Flashlight, QrCode } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Button from '../../components/ui/Button';
import { resolveStudentQr } from '../../services/teacherTools';
import { theme } from '../../constants/theme';

export default function QrScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [busy, setBusy] = useState(false);
    const [torch, setTorch] = useState(false);
    const scanLock = useRef(false);
    const scanLock = useRef(false);
    const focused = useIsFocused();

    async function onBarcodeScanned(result) {
        if (scanLock.current || scanned || busy) return;
        scanLock.current = true;
        setScanned(true);
        setBusy(true);
        try {
            const resolved = await resolveStudentQr(result.data);
            if (!resolved?.student?.id) throw new Error('El QR se leyó, pero no recibimos los datos del alumno.');
            router.push({
                pathname: '/observation',
                params: {
                    studentId: resolved.student.id,
                    studentName: resolved.student.name,
                    studentCode: resolved.student.code || '',
                    contexts: JSON.stringify(resolved.classrooms || []),
                },
            });
        } catch (error) {
            scanLock.current = false;
            Alert.alert('No se pudo abrir el registro', error.message, [{ text: 'Volver a escanear', onPress: () => setScanned(false) }]);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Screen scroll={false} contentStyle={styles.page}>
            <View style={styles.header}>
                <View style={styles.headIcon}><QrCode size={22} color={theme.colors.primary[900]} /></View>
                <View style={{ flex: 1 }}><TextApp size="xl" variant="bold">Escanear alumno</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Lee su QR para registrar una observación</TextApp></View>
            </View>

            {!permission ? <View style={styles.permission}><ActivityIndicator color={theme.colors.primary[700]} /></View> : !permission.granted ? (
                <View style={styles.permission}>
                    <View style={styles.permissionIcon}><Camera size={28} color={theme.colors.primary[800]} /></View>
                    <TextApp size="lg" variant="semibold" align="center">Permite el acceso a la cámara</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary} align="center">Usamos la cámara únicamente para escanear los códigos QR de tus alumnos.</TextApp>
                    <Button onPress={requestPermission}>Permitir cámara</Button>
                </View>
            ) : (
                <View style={styles.scanner}>
                    {focused && <CameraView
                        style={StyleSheet.absoluteFill}
                        facing="back"
                        enableTorch={torch}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                    />}
                    <View style={styles.scanOverlay} pointerEvents="box-none">
                        <View style={styles.frame} />
                        <TextApp size="sm" variant="medium" color="#fff" align="center" style={styles.instructions}>Centra el código QR del alumno dentro del marco</TextApp>
                    </View>
                    <View style={styles.scanActions}>
                        <Pressable style={styles.torchButton} onPress={() => setTorch((value) => !value)} accessibilityRole="button" accessibilityLabel={torch ? 'Apagar linterna' : 'Encender linterna'}>
                            <Flashlight size={19} color="#fff" />
                            <TextApp size="xs" color="#fff">{torch ? 'Apagar' : 'Linterna'}</TextApp>
                        </Pressable>
                        {scanned && !busy && <Button size="sm" variant="primary" onPress={() => setScanned(false)}>Escanear otro</Button>}
                    </View>
                    {busy && <View style={styles.busy}><ActivityIndicator size="large" color={theme.colors.primary[400]} /><TextApp size="sm" variant="semibold" color="#fff">Buscando alumno…</TextApp></View>}
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, paddingBottom: 0, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
    headIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    scanner: { flex: 1, marginHorizontal: 16, marginBottom: 14, minHeight: 360, overflow: 'hidden', borderRadius: 24, backgroundColor: '#171717' },
    scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: 'rgba(0,0,0,0.15)' },
    frame: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: theme.colors.primary[300], backgroundColor: 'transparent' },
    instructions: { maxWidth: 265, textShadowColor: '#000', textShadowRadius: 5 },
    scanActions: { position: 'absolute', left: 0, right: 0, bottom: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    torchButton: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    permission: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 14 },
    permissionIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
});
