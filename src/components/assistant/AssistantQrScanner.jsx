import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Camera, Flashlight, QrCode } from 'lucide-react-native';
import Screen from '../ui/Screen';
import TextApp from '../ui/TextApp';
import Button from '../ui/Button';
import { recordAssistantAttendance } from '../../services/teacherTools';
import { theme } from '../../constants/theme';

export default function AssistantQrScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [busy, setBusy] = useState(false);
    const [torch, setTorch] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const scanLock = useRef(false);
    const focused = useIsFocused();

    async function onScanned(result) {
        if (scanLock.current || scanned || busy) return;
        scanLock.current = true;
        setScanned(true);
        setBusy(true);
        setLastResult(null);
        try {
            const response = await recordAssistantAttendance(result.data);
            const status = response?.event?.attendance_status;
            const labels = { PUNCTUAL: 'Puntual', LATE: 'Tarde', ABSENCE: 'Falta' };
            const detail = {
                name: response?.student?.name || 'Alumno',
                code: response?.student?.code || '',
                status: labels[status] || status || 'Registrado',
                alreadyRecorded: Boolean(response?.alreadyRecorded),
                eventId: response?.event?.id,
            };
            setLastResult(detail);
            Alert.alert(
                response?.alreadyRecorded ? 'Asistencia ya registrada' : 'Asistencia registrada',
                `${detail.name}\n${detail.code ? `Código: ${detail.code}\n` : ''}Estado: ${detail.status}${response?.alreadyRecorded ? '\nEste alumno ya tenía un registro hoy.' : ''}`,
                [{ text: 'Continuar', onPress: () => { scanLock.current = false; setScanned(false); } }],
            );
        } catch (error) {
            Alert.alert('No se pudo registrar', error.message || 'Inténtalo nuevamente.', [{
                text: 'Volver a escanear',
                onPress: () => { scanLock.current = false; setScanned(false); },
            }]);
        } finally {
            setBusy(false);
        }
    }

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
                <View style={styles.permission}><ActivityIndicator color={theme.colors.primary[700} /></View>
            ) : !permission.granted ? (
                <View style={styles.permission}>
                    <View style={styles.permissionIcon}><Camera size={30} color={theme.colors.primary[800]} /></View>
                    <TextApp size="lg" variant="semibold">Permite el acceso a la cámara</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary} align="center">La cámara se utiliza únicamente para leer el código QR del alumno.</TextApp>
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
                        <View style={styles.frame} />
                        <TextApp size="sm" variant="medium" color="#fff" align="center" style={styles.instructions}>
                            Centra el QR del alumno dentro del marco
                        </TextApp>
                    </View>
                    <View style={styles.controls}>
                        <Button size="sm" variant="secondary" onPress={() => setTorch((value) => !value)}>
                            <Flashlight size={16} color={theme.colors.text.primary} /> {torch ? 'Apagar linterna' : 'Linterna'}
                        </Button>
                        {scanned && !busy && <Button size="sm" onPress={() => { scanLock.current = false; setScanned(false); }}>Escanear otro</Button>}
                    </View>
                    {busy && (
                        <View style={styles.busy}>
                            <ActivityIndicator size="large" color="#fff" />
                            <TextApp size="sm" variant="semibold" color="#fff">Registrando asistencia…</TextApp>
                        </View>
                    )}
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
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: 'rgba(0,0,0,0.10)' },
    frame: { width: 230, height: 230, borderWidth: 3, borderColor: '#FACC15', borderRadius: 26, backgroundColor: 'transparent' },
    instructions: { maxWidth: 270, textShadowColor: '#000', textShadowRadius: 5 },
    controls: { position: 'absolute', left: 0, right: 0, bottom: 14, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    permissionIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    notice: { marginHorizontal: 20, padding: 14, borderRadius: 16, backgroundColor: theme.colors.primary[100], gap: 5 },
});
