import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Camera, CheckCircle2, Clock3, QrCode, XCircle } from 'lucide-react-native';
import Screen from '../ui/Screen';
import TextApp from '../ui/TextApp';
import Button from '../ui/Button';
import { theme } from '../../constants/theme';
import { justifyAssistantAbsence, recordAssistantAttendance } from '../../services/teacherTools';

const statusLabels = { PUNCTUAL: 'Puntual', LATE: 'Tardanza', ABSENCE: 'Falta' };

export default function AssistantQrScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [justificationVisible, setJustificationVisible] = useState(false);
    const [justificationReason, setJustificationReason] = useState('');
    const [savingJustification, setSavingJustification] = useState(false);
    const scanLock = useRef(false);
    const focused = useIsFocused();

    const onScanned = useCallback(async ({ data }) => {
        if (scanLock.current || !data) return;
        scanLock.current = true;
        setProcessing(true);
        setErrorMessage('');
        setResult(null);
        try {
            const response = await recordAssistantAttendance(data);
            setResult(response);
        } catch (error) {
            setErrorMessage(error.message || 'No se pudo registrar la asistencia.');
        } finally {
            setProcessing(false);
        }
    }, []);

    const submitJustification = async () => {
        if (!result?.event?.id || justificationReason.trim().length < 4) {
            Alert.alert('Motivo requerido', 'Escribe al menos 4 caracteres para justificar la falta.');
            return;
        }
        setSavingJustification(true);
        try {
            const response = await justifyAssistantAbsence(result.event.id, justificationReason.trim());
            setResult((current) => ({ ...current, event: { ...current.event, ...response.data } }));
            setJustificationVisible(false);
            setJustificationReason('');
            Alert.alert('Justificación guardada', 'La falta quedó marcada como justificada.');
        } catch (error) {
            Alert.alert('No se pudo justificar', error.message || 'Inténtalo nuevamente.');
        } finally {
            setSavingJustification(false);
        }
    };

    const resetScanner = () => {
        scanLock.current = false;
        setResult(null);
        setErrorMessage('');
        setJustificationVisible(false);
        setJustificationReason('');
    };

    const status = result?.event?.attendance_status;
    const StatusIcon = status === 'PUNCTUAL' ? CheckCircle2 : status === 'LATE' ? Clock3 : XCircle;

    return (
        <Screen scroll={false} contentStyle={styles.page}>
            <View style={styles.header}>
                <View style={styles.headerIcon}><QrCode size={22} color={theme.colors.primary[900]} /></View>
                <View style={styles.headerText}>
                    <TextApp size="xl" variant="bold">Asistencia institucional</TextApp>
                    <TextApp size="xs" color={theme.colors.text.secondary}>Escanea el QR de cualquier alumno activo</TextApp>
                </View>
            </View>

            {!permission ? (
                <View style={styles.permission}><ActivityIndicator /></View>
            ) : !permission.granted ? (
                <View style={styles.permission}>
                    <Camera size={34} color={theme.colors.primary[800]} />
                    <TextApp size="lg" variant="semibold">Permite el acceso a la cámara</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary} align="center">La cámara se utiliza para leer el código QR del alumno.</TextApp>
                    <Button onPress={requestPermission}>Permitir cámara</Button>
                </View>
            ) : (
                <View style={styles.scanner}>
                    {focused && !result && !errorMessage && (
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={processing ? undefined : onScanned}
                        />
                    )}
                    <View style={styles.overlay} pointerEvents="none">
                        <View style={styles.frame} />
                        <TextApp size="sm" color="#fff" align="center">Centra el QR del alumno en el marco</TextApp>
                    </View>
                    {processing && (
                        <View style={styles.feedback}>
                            <ActivityIndicator color="#fff" />
                            <TextApp size="sm" color="#fff">Registrando asistencia…</TextApp>
                        </View>
                    )}
                    {!!errorMessage && (
                        <View style={styles.feedback}>
                            <XCircle size={30} color="#fecaca" />
                            <TextApp size="md" variant="semibold" color="#fff" align="center">{errorMessage}</TextApp>
                            <Button size="sm" onPress={resetScanner}>Volver a escanear</Button>
                        </View>
                    )}
                    {!!result && (
                        <View style={styles.feedback}>
                            <StatusIcon size={34} color={status === 'PUNCTUAL' ? '#86efac' : status === 'LATE' ? '#fde68a' : '#fecaca'} />
                            <TextApp size="lg" variant="bold" color="#fff" align="center">{result.student?.name || 'Alumno'}</TextApp>
                            {!!result.student?.code && <TextApp size="sm" color="#e5e7eb">Código: {result.student.code}</TextApp>}
                            <TextApp size="md" variant="semibold" color="#fff">{result.alreadyRecorded ? 'Ya tenía asistencia registrada hoy' : 'Asistencia registrada'}</TextApp>
                            <TextApp size="sm" color="#fff">{statusLabels[status] || 'Registro existente'}</TextApp>
                            {result.event?.justification_status === 'UNJUSTIFIED' && <>
                                <TextApp size="xs" color="#fde68a">Esta falta queda pendiente de justificación.</TextApp>
                                <Button size="sm" variant="warning" onPress={() => setJustificationVisible(true)}>Justificar falta</Button>
                            </>}
                            {result.event?.justification_status === 'JUSTIFIED' && <TextApp size="xs" color="#86efac">Falta justificada</TextApp>}
                            <Button size="sm" onPress={resetScanner}>Escanear siguiente alumno</Button>
                        </View>
                    )}
                </View>
            )}

            <Modal visible={justificationVisible} transparent animationType="fade" onRequestClose={() => setJustificationVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <TextApp size="lg" variant="bold">Justificar falta</TextApp>
                        <TextApp size="sm" color={theme.colors.text.secondary}>Registra el motivo. La asistencia original se conserva y queda marcada como justificada.</TextApp>
                        <TextInput value={justificationReason} onChangeText={setJustificationReason} placeholder="Motivo de la justificación" multiline maxLength={1000} textAlignVertical="top" style={styles.reasonInput} />
                        <View style={styles.modalActions}>
                            <Button variant="outline" onPress={() => setJustificationVisible(false)} disabled={savingJustification}>Cancelar</Button>
                            <Button onPress={submitJustification} loading={savingJustification}>Guardar</Button>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.notice}>
                <TextApp size="sm" variant="semibold">Horario de ingreso</TextApp>
                <TextApp size="xs" color={theme.colors.text.secondary}>Puntual: 07:00–07:45 · Tarde: 07:45–08:00 · Desde las 08:00: falta. El servidor aplica el horario configurado para el nivel del alumno.</TextApp>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, gap: 12, paddingBottom: 10 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
    headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, gap: 3 },
    scanner: { flex: 1, minHeight: 280, marginHorizontal: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: '#171717', position: 'relative' },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 8 },
    frame: { width: 230, height: 230, borderWidth: 3, borderColor: '#facc15', borderRadius: 26, alignSelf: 'center' },
    permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
    feedback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.94)' },
    notice: { marginHorizontal: 20, padding: 14, borderRadius: 16, backgroundColor: theme.colors.primary[100], gap: 5 },
    modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
    modalCard: { padding: 20, borderRadius: 20, backgroundColor: '#fff', gap: 12 },
    reasonInput: { minHeight: 110, borderWidth: 1, borderColor: theme.colors.border.DEFAULT, borderRadius: 12, padding: 12, color: theme.colors.text.primary },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
