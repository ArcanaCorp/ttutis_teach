import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bell, CalendarDays, ClipboardPenLine, FileText, GraduationCap, Mail, Phone, UserRound } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { getStudentDetail } from '../../services/academicServices';
import { theme } from '../../constants/theme';

function dateLabel(value) {
    if (!value) return 'No registrado';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <View style={styles.infoRow}>
            <Icon size={17} color={theme.colors.primary[700]} />
            <View style={{ flex: 1, gap: 2 }}>
                <TextApp size="xs" color={theme.colors.text.tertiary}>{label}</TextApp>
                <TextApp size="sm">{value || 'No registrado'}</TextApp>
            </View>
        </View>
    );
}

export default function StudentDetail() {
    const params = useLocalSearchParams();
    const { staff } = useAuth();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    const load = useCallback(async () => {
        const result = await getStudentDetail(String(params.id || ''), staff?.institutionId, String(params.classroomId || ''), String(params.enrollmentId || ''));
        setStudent(result);
        setLoadError('');
    }, [params.id, params.classroomId, params.enrollmentId, staff?.institutionId]);

    useEffect(() => {
        let active = true;
        Promise.resolve().then(load).catch((error) => {
            if (active) {
                setStudent(null);
                setLoadError(error.message || 'Ocurrió un error inesperado al consultar la ficha.');
            }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [load]);

    async function refresh() {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    }

    function openObservation() {
        const contexts = [{
            classroomId: String(params.classroomId),
            academicYearId: student.academic_year_id || String(params.academicYearId || ''),
            classroomName: student.classroomName || String(params.classroomName || 'Aula'),
            isTutor: String(params.isTutor) === 'true',
        }];
        router.push({
            pathname: '/(tabs)/observation',
            params: {
                studentId: student.id,
                studentName: student.fullName,
                studentCode: student.student_code || '',
                contexts: JSON.stringify(contexts),
                returnTo: `/student/${student.id}?classroomId=${params.classroomId}&academicYearId=${params.academicYearId}&classroomName=${encodeURIComponent(student.classroomName || '')}&isTutor=${params.isTutor}`,
            },
        });
    }

    function openAnnouncements() {
        router.push({ pathname: '/class/[id]', params: { id: String(params.scheduleId || ''), initialTab: 'announcements' } });
    }

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver a alumnos"><ArrowLeft size={20} color={theme.colors.text.primary} /></Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                    <TextApp size="xl" variant="bold">Ficha del alumno</TextApp>
                    <TextApp size="xs" color={theme.colors.text.secondary}>{student?.classroomName || String(params.classroomName || 'Aula')}</TextApp>
                </View>
            </View>
            {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 32 }} /> : !student ? (
                <View style={styles.empty}><TextApp size="md" variant="semibold">No se pudo cargar la ficha</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">{loadError || 'No se pudo recuperar la información del alumno.'}</TextApp><Button size="sm" variant="outline" onPress={() => { setLoading(true); load().catch((error) => setLoadError(error.message)).finally(() => setLoading(false)); }}>Reintentar</Button></View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.hero}>
                        <View style={styles.avatar}><UserRound size={28} color={theme.colors.primary[800]} /></View>
                        <View style={{ flex: 1, gap: 3 }}>
                            <TextApp size="lg" variant="bold">{student.fullName}</TextApp>
                            <TextApp size="xs" color={theme.colors.text.secondary}>Código: {student.student_code || 'Sin código'}</TextApp>
                            <TextApp size="xs" color={theme.colors.text.secondary}>Estado: {student.status || '—'}</TextApp>
                        </View>
                    </View>

                    <TextApp size="md" variant="semibold">Acciones</TextApp>
                    <View style={styles.actions}>
                        <Pressable style={styles.action} onPress={openAnnouncements} accessibilityRole="button">
                            <Bell size={19} color={theme.colors.primary[800]} />
                            <TextApp size="xs" variant="semibold">Enviar anuncio</TextApp>
                        </Pressable>
                        <Pressable style={styles.action} onPress={openObservation} accessibilityRole="button">
                            <ClipboardPenLine size={19} color={theme.colors.primary[800]} />
                            <TextApp size="xs" variant="semibold">Levantar evento</TextApp>
                        </Pressable>
                        <Pressable style={styles.action} onPress={() => router.push('/(tabs)/assessments')} accessibilityRole="button">
                            <GraduationCap size={19} color={theme.colors.primary[800]} />
                            <TextApp size="xs" variant="semibold">Evaluaciones</TextApp>
                        </Pressable>
                    </View>

                    <TextApp size="md" variant="semibold">Datos personales</TextApp>
                    <InfoRow icon={FileText} label="Documento" value={[student.document_type, student.document_number].filter(Boolean).join(' · ')} />
                    <InfoRow icon={CalendarDays} label="Fecha de nacimiento" value={dateLabel(student.birth_date)} />
                    <InfoRow icon={Phone} label="Teléfono" value={student.phone} />
                    <InfoRow icon={Mail} label="Correo" value={student.email} />
                    <TextApp size="md" variant="semibold">Matrícula</TextApp>
                    <InfoRow icon={GraduationCap} label="Aula" value={student.classroomName} />
                    <InfoRow icon={CalendarDays} label="Año escolar" value={student.academicYearName} />
                    <InfoRow icon={CalendarDays} label="Fecha de matrícula" value={dateLabel(student.enrolledAt)} />
                    <InfoRow icon={CalendarDays} label="Fecha de ingreso" value={dateLabel(student.admission_date)} />

                    <TextApp size="md" variant="semibold">Apoderados vinculados</TextApp>
                    <TextApp size="sm" color={theme.colors.text.tertiary}>La información de apoderados está protegida por permisos institucionales y no se muestra en esta ficha.</TextApp>

                    <TextApp size="md" variant="semibold">Últimas observaciones y comunicaciones</TextApp>
                    {student.updates.length ? student.updates.map((item) => (
                        <View key={item.id} style={styles.historyRow}>
                            <TextApp size="sm" variant="semibold">{item.title}</TextApp>
                            <TextApp size="xs" color={theme.colors.text.secondary}>{item.update_type} · {dateLabel(item.created_at)}</TextApp>
                            {!!item.body && <TextApp size="sm" color={theme.colors.text.secondary}>{item.body}</TextApp>}
                        </View>
                    )) : <TextApp size="sm" color={theme.colors.text.tertiary}>{student.updatesError ? 'No fue posible consultar las comunicaciones con los permisos actuales.' : 'Todavía no hay registros.'}</TextApp>}

                    <TextApp size="md" variant="semibold">Asistencia reciente</TextApp>
                    {student.attendance.length ? student.attendance.map((item) => (
                        <View key={item.id} style={styles.historyRow}>
                            <TextApp size="sm" variant="semibold">{item.event_type}</TextApp>
                            <TextApp size="xs" color={theme.colors.text.secondary}>{new Date(item.occurred_at).toLocaleString('es-PE')}</TextApp>
                            {!!item.notes && <TextApp size="sm" color={theme.colors.text.secondary}>{item.notes}</TextApp>}
                        </View>
                    )) : <TextApp size="sm" color={theme.colors.text.tertiary}>{student.attendanceError ? 'No fue posible consultar la asistencia con los permisos actuales.' : 'No hay marcaciones registradas.'}</TextApp>}
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: 18 },
    back: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, gap: 11, paddingBottom: 28 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderRadius: 18, backgroundColor: theme.colors.primary[100] },
    avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    actions: { flexDirection: 'row', gap: 8 },
    action: { flex: 1, minHeight: 84, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border.subtle, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 13, borderRadius: 14 },
    historyRow: { gap: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 13, borderRadius: 14 },
    empty: { marginHorizontal: 20, marginTop: 24, alignItems: 'center', gap: 10, padding: 24, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle },
});
