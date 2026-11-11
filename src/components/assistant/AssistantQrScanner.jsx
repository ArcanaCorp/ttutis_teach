import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Camera, Flashlight, QrCode } from 'lucide-react-native';
import Screen from '../ui/Screen';
import TextApp from '../ui/TextApp';
import Button from '../ui/Button';
import { recordAssistantAttendance } from '../../services/teacherTools';
import { theme } from '../../constants/theme';

const STATUS_LABELS = {
    PUNCTUAL: 'Puntual',
    LATE: 'Tarde',
    ABSENCE: 'Falta',
};

export default function AssistantQrScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [busy, setBusy] = useState(false);
    const [torch, setTorch] = useState(false);
    const [toast, setToast] = useState(null);
    const scanLock = useRef(false);
    const lastScan = useRef(null);
    const toastSequence = useRef(0);
    const focused = useIsFocused();

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), toast.type === 'error' ? 2800 : 1900);
        return () => clearTimeout(timer);
    }, [toast]);

    async function onScanned(result) {
        const value = typeof result?.data === 'string' ? result.data.trim() : '';
        if (scanLock.current || !value) return;

        // The camera can emit the same QR several times in consecutive frames.
        // Ignore only that same code briefly; a different student can scan immediately.
        const now = Date.now();
        if (lastScan.current?.value === value && now - lastScan.current.at < 1400) return;

        scanLock.current = true;
        lastScan.current = { value, at: now };
        setScanned(true);
        setBusy(true);
        setToast(null);

        try {
            const response = await recordAssistantAttendance(value);
            const status = STATUS_LABELS[response?.event?.attendance_status] || 'Registrado';
            const studentName = response?.student?.name || 'Alumno';
            const studentCode = response?.student?.code ? ` · ${response.student.code}` : '';
            const alreadyRecorded = Boolean(response?.alreadyRecorded);

            setToast({
                id: ++toastSequence.current,
                type: alreadyRecorded ? 'info' : 'success',
                title: alreadyRecorded ? 'Ya estaba registrada' : `Asistencia ${status.toLowerCase()}`,
                message: `${studentName}${studentCode}`,
            });
        } catch (error) {
            // Allow the same QR to be retried immediately after a failed request.
            lastScan.current = null;
            setToast({
                id: ++toastSequence.current,
                type: 'error',
                title: 'No se pudo registrar',
                message: error?.message || 'Verifica la conexión e inténtalo nuevamente.',
            });
        } finally {
            // Release the scanner as soon as the server confirms or rejects the request.
            // No button tap or modal dismissal is required for the next student.
            scanLock.current = false;
            setBusy(false);
            setScanned(false);
        }
    }

    const toastBackground = toast?.type === 'error'
        ? '#991B1B'
        : toast?.type === 'info' ? '#334155' : '#166534';

    return (
        <Screen scroll={false} contentStyle={styles.page}>
            <View style={styles.header}>
                <View style={styles.headIcon}><QrCode size={22} color={theme.colors.primary[900]} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                    <TextApp size="xl" variant="bold">Asistencia institucional</TextApp>
                    <TextApp size="xs" color={theme.colors.text.secondary}>Escanea el QR de cualquier alumno activo</TextApp>
                </View>
            </View>

            {!permission ? (
                <View style={styles.permission}><ActivityIndicator color={theme.colors.primary[700]} /></View>
            ) : !permission.granted ? (
                <View style={styles.permission}>
                    <View style={styles.permissionIcon}><Camera size={30} color={theme.colors.primary[800]} /></View>
                    <TextApp size="lg" variant="semibold">Permite el acceso a la cámara</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary} align="center}>La cámara se utiliza únicamente para leer el código QR del alumno.</TextApp>
                    <Button onPress={requestPermission}>Permitir cámara</Button>
                </View>
            ) : (
                <View style={styles.scanner}>
                    {focused && (
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            enableTorch={torch}
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={scanned ? undefined : onScanned}
                        />
                    )}
                    <View style={styles.overlay} pointerEvents="box-none">
                        <View style={styles.frameCenter}><View style={styles.frame} /></View>
                        <TextApp size="sm" variant="medium" color="#fff" align="center" style={styles.instructions}>
                            Centra el QR del alumno dentro del marco
                        </TextApp>
                    </View>

                    {toast && (
                        <View
                            key={toast.id}
                            pointerEvents="none"
                            accessibilityRole="alert"
                            accessibilityLiveRegion="polite"
                            style={[styles.toast, { backgroundColor: toastBackground }]}
                        >
                            <TextApp size="sm" variant="semibold" color="#fff">{toast.title}</TextApp>
                            <TextApp size="xs" color="#fff">{toast.message}</TextApp>
                        </View>
                    )}

                    {busy && (
                        <View style={styles.processing} pointerEvents="none">
                            <ActivityIndicator size="small" color="#fff" />
                            <TextApp size="xs" variant="semibold" color="#fff">Guardando…</TextApp>
                        </View>
                    )}

                    <View style={styles.controls}>
                        <Button size="sm" variant="secondary" icon={Flashlight} onPress={() => setTorch((value) => !value)}>
                            {torch ? 'Apagar linterna' : 'Linterna'}
                        </Button>
                    </View>
                </View>
            )}

            <View style={styles.notice}>
                <TextApp size="sm" variant="semibold">Ventana de asistencia</TextApp>
                <TextApp size="xs" color={theme.colors.text.secondary}>
                    El servidor valida el horario del nivel y clasifica el ingreso como puntual, tarde o falta. Un alumno solo puede registrar una entrada por día.
                </TextApp>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, paddingBottom: 8, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10 },
    headIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    scanner: { flex: 1, minHeight: 300, marginHorizontal: 16, marginBottom: 4, borderRadius: 22, overflow: 'hidden', backgroundColor: '#171717', alignItems: 'stretch', justifyContent: 'center' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },
    frameCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    frame: { width: 230, height: 230, borderWidth: 3, borderColor: '#FACC15', borderRadius: 26, backgroundColor: 'transparent' },
    instructions: { position: 'absolute', bottom: 72, alignSelf: 'center', maxWidth: 270, textShadowColor: '#000', textShadowRadius: 5 },
    controls: { position: 'absolute', left: 0, right: 0, bottom: 14, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
    toast: { position: 'absolute', top: 14, left: 14, right: 14, zIndex: 5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 2, elevation: 6 },
    processing: { position: 'absolute', bottom: 66, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.68)' },
    permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    permissionIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    notice: { marginHorizontal: 20, padding: 14, borderRadius: 16, backgroundColor: theme.colors.primary[100], gap: 5 },
});
