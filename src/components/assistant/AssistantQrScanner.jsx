import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    StyleSheet,
    View,
    Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import {
    Camera,
    Flashlight,
    QrCode,
} from 'lucide-react-native';
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

const QUEUE_STORAGE_KEY = '@ttutis/assistant-attendance-queue-v1';
const RETRY_INTERVAL_MS = 5000;

export default function AssistantQrScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [queueLoaded, setQueueLoaded] = useState(false);
    const [torch, setTorch] = useState(false);
    const [toast, setToast] = useState(null);

    // La cola y los bloqueos viven en refs para evitar cierres obsoletos.
    const queueRef = useRef([]);
    const queueWrite = useRef(Promise.resolve());
    const pendingScans = useRef(new Set());
    const recentScans = useRef(new Map());
    const sequence = useRef(0);
    const toastSequence = useRef(0);
    const syncing = useRef(false);
    const focused = useIsFocused();

    const showToast = useCallback((type, title, message, duration = 2200) => {
        setToast({
            id: ++toastSequence.current,
            type,
            title,
            message,
            duration,
        });
    }, []);

    const persistQueue = useCallback((nextQueue) => {
        // Actualización optimista local: la interfaz refleja la cola de inmediato.
        queueRef.current = nextQueue;

        // Serializa escrituras para que una operación lenta no sobrescriba otra.
        queueWrite.current = queueWrite.current
            .catch(() => undefined)
            .then(() => AsyncStorage.setItem(
                QUEUE_STORAGE_KEY,
                JSON.stringify(nextQueue),
            ));

        return queueWrite.current;
    }, []);

    // Recupera los registros pendientes incluso después de cerrar la aplicación.
    useEffect(() => {
        let active = true;

        AsyncStorage.getItem(QUEUE_STORAGE_KEY)
            .then((raw) => {
                if (!active || !raw) return;

                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return;

                const restored = parsed.map((item) => ({
                    ...item,
                    status: 'PENDING',
                }));

                queueRef.current = restored;
            })
            .catch((error) => {
                console.warn(
                    '[ASSISTANT_QR] queue_restore_failed',
                    error?.message || error,
                );

                if (active) {
                    showToast(
                        'error',
                        'No se pudo recuperar la cola',
                        'Revisa el almacenamiento del dispositivo.',
                        3500,
                    );
                }
            })
            .finally(() => {
                if (active) setQueueLoaded(true);
            });

        return () => {
            active = false;
        };
    }, [showToast]);

    // Envía los registros guardados al servidor en orden de llegada.
    const syncQueue = useCallback(async () => {
        if (
            !queueLoaded
            || syncing.current
            || queueRef.current.length === 0
        ) {
            return;
        }

        syncing.current = true;

        try {
            while (queueRef.current.length > 0) {
                const item = queueRef.current[0];

                try {
                    const response = await recordAssistantAttendance(item.value);

                    // Solo se elimina de la cola después de una respuesta exitosa.
                    await persistQueue(
                        queueRef.current.filter(
                            (entry) => entry.localId !== item.localId,
                        ),
                    );

                    const attendanceStatus = response?.event?.attendance_status;
                    const statusLabel = STATUS_LABELS[attendanceStatus] || 'Registrada';
                    const studentName = response?.student?.name || 'Alumno';
                    const studentCode = response?.student?.code;

                    showToast(
                        response?.alreadyRecorded ? 'info' : 'success',
                        response?.alreadyRecorded
                            ? 'Asistencia ya registrada'
                            : 'Asistencia registrada',
                        `${studentName}${studentCode ? ` · ${studentCode}` : ''} · ${statusLabel}`,
                    );

                    Vibration.vibrate(25);
                } catch (error) {
                    const status = Number(error?.status);
                    const permanentRejection = (
                        status >= 400
                        && status < 500
                        && status !== 401
                        && status !== 403
                    );

                    if (permanentRejection) {
                        await persistQueue(
                            queueRef.current.filter(
                                (entry) => entry.localId !== item.localId,
                            ),
                        );

                        recentScans.current.delete(item.value);

                        showToast(
                            'error',
                            'Asistencia rechazada',
                            error?.message || 'El servidor no aceptó el registro.',
                            3500,
                        );

                        continue;
                    }

                    // Error de red o de autenticación: se conserva el registro.
                    await persistQueue(
                        queueRef.current.map((entry) => (
                            entry.localId === item.localId
                                ? {
                                    ...entry,
                                    status: 'PENDING',
                                    attempts: (entry.attempts || 0) + 1,
                                    lastAttemptAt: new Date().toISOString(),
                                }
                                : entry
                        )),
                    );

                    showToast(
                        'pending',
                        'Guardado sin conexión',
                        'Se enviará al recuperar internet.',
                        2200,
                    );

                    // No se altera el orden de la cola: se reintentará más tarde.
                    break;
                }
            }
        } catch (error) {
            console.warn(
                '[ASSISTANT_QR] queue_sync_failed',
                error?.message || error,
            );

            showToast(
                'error',
                'No se pudo actualizar la cola',
                'El registro permanece guardado en el dispositivo.',
                3000,
            );
        } finally {
            syncing.current = false;
        }
    }, [persistQueue, queueLoaded, showToast]);

    // Reintenta al abrir/activar la app y periódicamente mientras está activa.
    useEffect(() => {
        if (!queueLoaded) return undefined;

        syncQueue();

        const interval = setInterval(syncQueue, RETRY_INTERVAL_MS);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') syncQueue();
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [queueLoaded, syncQueue]);

    useEffect(() => {
        if (!toast) return undefined;

        const timer = setTimeout(
            () => setToast(null),
            toast.duration || 2200,
        );

        return () => clearTimeout(timer);
    }, [toast]);

    const onScanned = useCallback(async (scan) => {
        const value = typeof scan?.data === 'string'
            ? scan.data.trim()
            : '';

        if (!value || !queueLoaded) return;

        const now = Date.now();
        const previous = recentScans.current.get(value);

        // Evita duplicados simultáneos, ya en cola o repetidos inmediatamente.
        if (
            pendingScans.current.has(value)
            || queueRef.current.some((item) => item.value === value)
            || (previous && now - previous < 1500)
        ) {
            return;
        }

        const requestId = ++sequence.current;
        const item = {
            localId: `assistant-${now}-${requestId}`,
            value,
            createdAt: new Date(now).toISOString(),
            status: 'PENDING',
            attempts: 0,
        };

        pendingScans.current.add(value);
        recentScans.current.set(value, now);

        Vibration.vibrate(45);
        showToast(
            'pending',
            'QR leído',
            'Registrando asistencia…',
            1400,
        );

        console.log(
            '[ASSISTANT_QR] scan_received',
            JSON.stringify({
                requestId,
                timestamp: item.createdAt,
                pending: queueRef.current.length + 1,
            }),
        );

        try {
            // La lectura se persiste localmente antes de iniciar la sincronización.
            await persistQueue([...queueRef.current, item]);

            console.log(
                '[ASSISTANT_QR] local_saved',
                JSON.stringify({
                    requestId,
                    timestamp: new Date().toISOString(),
                    queueSize: queueRef.current.length,
                }),
            );

            syncQueue();
        } catch (error) {
            recentScans.current.delete(value);

            showToast(
                'error',
                'No se pudo guardar',
                'No se registró localmente. Vuelve a escanear.',
                3200,
            );

            console.error(
                '[ASSISTANT_QR] local_save_failed',
                error?.message || error,
            );
        } finally {
            pendingScans.current.delete(value);
        }
    }, [persistQueue, queueLoaded, showToast, syncQueue]);

    const toastBackground = toast?.type === 'error'
        ? '#991B1B'
        : toast?.type === 'info'
            ? '#334155'
            : toast?.type === 'pending'
                ? '#1D4ED8'
                : '#166534';

    return (
        <Screen scroll={false} contentStyle={styles.page}>
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <QrCode size={22} color={theme.colors.primary[900]} />
                </View>

                <View style={styles.headerText}>
                    <TextApp size="xl" variant="bold">
                        Asistencia institucional
                    </TextApp>
                    <TextApp size="xs" color={theme.colors.text.secondary}>
                        Escanea el QR de cualquier alumno activo
                    </TextApp>
                </View>
            </View>

            {!permission ? (
                <View style={styles.permission}>
                    <ActivityIndicator color={theme.colors.primary[700]} />
                </View>
            ) : !permission.granted ? (
                <View style={styles.permission}>
                    <View style={styles.permissionIcon}>
                        <Camera size={30} color={theme.colors.primary[800]} />
                    </View>
                    <TextApp size="lg" variant="semibold">
                        Permite el acceso a la cámara
                    </TextApp>
                    <TextApp
                        size="sm"
                        color={theme.colors.text.secondary}
                        align="center"
                    >
                        La cámara se utiliza únicamente para leer el código QR del alumno.
                    </TextApp>
                    <Button onPress={requestPermission}>
                        Permitir cámara
                    </Button>
                </View>
            ) : (
                <View style={styles.scanner}>
                    {focused && (
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            enableTorch={torch}
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={onScanned}
                        />
                    )}

                    <View style={styles.overlay} pointerEvents="box-none">
                        <View style={styles.frameCenter}>
                            <View style={styles.frame} />
                        </View>

                        <TextApp
                            size="sm"
                            variant="medium"
                            color="#fff"
                            align="center"
                            style={styles.instructions}
                        >
                            Centra el QR del alumno dentro del marco
                        </TextApp>
                    </View>

                    {toast && (
                        <View
                            key={toast.id}
                            pointerEvents="none"
                            accessibilityRole="alert"
                            accessibilityLiveRegion="polite"
                            style={[
                                styles.toast,
                                { backgroundColor: toastBackground },
                            ]}
                        >
                            <TextApp size="sm" variant="semibold" color="#fff">
                                {toast.title}
                            </TextApp>
                            <TextApp size="xs" color="#fff">
                                {toast.message}
                            </TextApp>
                        </View>
                    )}

                    <View style={styles.controls}>
                        <Button
                            size="sm"
                            variant="secondary"
                            icon={Flashlight}
                            onPress={() => setTorch((value) => !value)}
                        >
                            {torch ? 'Apagar linterna' : 'Linterna'}
                        </Button>
                    </View>
                </View>
            )}


        </Screen>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        paddingBottom: 8,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: theme.colors.primary[100],
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        gap: 3,
    },
    scanner: {
        flex: 1,
        minHeight: 300,
        marginHorizontal: 16,
        marginBottom: 4,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#171717',
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.10)',
    },
    frameCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    frame: {
        width: 230,
        height: 230,
        borderWidth: 3,
        borderColor: '#FACC15',
        borderRadius: 26,
        backgroundColor: 'transparent',
    },
    instructions: {
        position: 'absolute',
        top: '50%',
        marginTop: 124,
        alignSelf: 'center',
        width: '88%',
        maxWidth: 300,
        textShadowColor: '#000',
        textShadowRadius: 5,
    },
    controls: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 14,
        paddingHorizontal: 14,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    toast: {
        position: 'absolute',
        top: 14,
        left: 14,
        right: 14,
        zIndex: 5,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 2,
        elevation: 6,
    },
    permission: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
    },
    permissionIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: theme.colors.primary[100],
        alignItems: 'center',
        justifyContent: 'center',
    },
});
