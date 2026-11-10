import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bell, CalendarDays, Clock3, GraduationCap, MapPin, Megaphone, Save, Users } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { getAssessments, getScheduleDetail } from '../../services/academicServices';
import { createClassAnnouncement, getClassAnnouncements } from '../../services/teacherTools';
import { theme } from '../../constants/theme';

const tabs = [
    { id: 'info', label: 'Información', icon: GraduationCap },
    { id: 'students', label: 'Alumnos', icon: Users },
    { id: 'announcements', label: 'Anuncios', icon: Megaphone },
    { id: 'grades', label: 'Calificaciones', icon: CalendarDays },
];

function formatDate(value) {
    if (!value) return 'Fecha pendiente';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ClassDetail() {
    const { id } = useLocalSearchParams();
    const { staff } = useAuth();
    const [detail, setDetail] = useState(null);
    const [assessments, setAssessments] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [tab, setTab] = useState('info');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const classDetail = await getScheduleDetail(String(id || ''), staff?.institutionId);
        setDetail(classDetail);
        if (classDetail?.classroomId && staff?.membershipId) {
            const result = await getAssessments(staff.institutionId, staff.membershipId);
            setAssessments(result.assessments.filter((item) => item.classroom_id === classDetail.classroomId));
        }
    }, [id, staff]);

    useEffect(() => {
        let active = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- load fetches course data from Supabase after the route is focused.
        load().catch(() => {}).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [load]);

    useEffect(() => {
        if (tab !== 'announcements' || !detail?.classroomId) return undefined;
        let active = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- loading indicator is tied to this tab's network request.
        setLoadingAnnouncements(true);
        getClassAnnouncements(detail.classroomId, { sectionId: detail.schema === 'modern' ? detail.classroomId : undefined, courseOfferingId: detail.schema === 'modern' ? detail.courseAssignmentId : undefined, academicYearId: detail.schema === 'modern' ? detail.academicYearId : undefined }).then((items) => { if (active) setAnnouncements(items); })
            .catch((error) => { if (active) Alert.alert('Anuncios', error.message); })
            .finally(() => { if (active) setLoadingAnnouncements(false); });
        return () => { active = false; };
    }, [tab, detail?.classroomId, detail?.schema, detail?.courseAssignmentId, detail?.academicYearId]);

    const students = useMemo(() => detail?.students || [], [detail]);

    async function refresh() {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    }

    async function publishAnnouncement() {
        if (!title.trim() || !body.trim()) {
            Alert.alert('Completa el anuncio', 'Agrega un título y el mensaje para el curso.');
            return;
        }
        setSavingAnnouncement(true);
        try {
            const item = await createClassAnnouncement({
                classroomId: detail.schema === 'legacy' ? detail.classroomId : undefined,
                sectionId: detail.schema === 'modern' ? detail.classroomId : undefined,
                courseOfferingId: detail.schema === 'modern' ? detail.courseAssignmentId : undefined,
                academicYearId: detail.academicYearId,
                title,
                body,
            });
            setAnnouncements((current) => [item, ...current]);
            setTitle('');
            setBody('');
            setShowAnnouncementForm(false);
            Alert.alert('Anuncio publicado', 'El anuncio ya está disponible para el curso.');
        } catch (error) {
            Alert.alert('No se pudo publicar', error.message);
        } finally {
            setSavingAnnouncement(false);
        }
    }

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver al horario"><ArrowLeft size={20} color={theme.colors.text.primary} /></Pressable>
                <View style={{ flex: 1, gap: 2 }}><TextApp size="xl" variant="bold">{detail?.subject || 'Detalle del curso'}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{detail?.section || 'Horario, alumnos y curso'}</TextApp></View>
            </View>

            <View style={styles.tabScroller}>
                {tabs.map(({ id: tabId, label, icon: Icon }) => (
                    <Pressable key={tabId} onPress={() => setTab(tabId)} style={[styles.tab, tab === tabId && styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: tab === tabId }}>
                        <Icon size={15} color={tab === tabId ? theme.colors.primary[800] : theme.colors.text.tertiary} />
                        <TextApp size="xs" variant={tab === tabId ? 'semibold' : 'medium'} color={tab === tabId ? theme.colors.primary[950] : theme.colors.text.secondary}>{label}</TextApp>
                    </Pressable>
                ))}
            </View>

            {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 32 }} /> : !detail ? (
                <View style={styles.empty}><TextApp size="md" variant="semibold">No encontramos este curso</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">Vuelve al horario y abre el curso otra vez.</TextApp></View>
            ) : tab === 'info' ? (
                <View style={styles.content}>
                    <View style={styles.hero}><TextApp size="xl" variant="bold">{detail.subject}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{detail.section}</TextApp></View>
                    <View style={styles.infoRow}><CalendarDays size={18} color={theme.colors.primary[700]} /><TextApp size="sm">{detail.weekday ? `Día ${detail.weekday}` : 'Día de clase asignado'}</TextApp></View>
                    <View style={styles.infoRow}><Clock3 size={18} color={theme.colors.primary[700]} /><TextApp size="sm">{detail.start_time?.slice(0, 5) || '—'} – {detail.end_time?.slice(0, 5) || '—'}</TextApp></View>
                    <View style={styles.infoRow}><MapPin size={18} color={theme.colors.primary[700]} /><TextApp size="sm">{detail.classroom_label || 'Aula por confirmar'}</TextApp></View>
                    <View style={styles.infoRow}><Users size={18} color={theme.colors.primary[700]} /><TextApp size="sm">{students.length} alumnos matriculados</TextApp></View>
                </View>
            ) : tab === 'students' ? (
                <View style={styles.content}>
                    <TextApp size="lg" variant="semibold">Alumnos ({students.length})</TextApp>
                    {students.length ? students.map((student, index) => (
                        <View key={student.id} style={styles.studentRow}><View style={styles.number}><TextApp size="xs" variant="semibold">{index + 1}</TextApp></View><View style={{ flex: 1, gap: 2 }}><TextApp size="sm" variant="medium">{student.name}</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>{student.code || 'Sin código'}</TextApp></View></View>
                    )) : <View style={styles.empty}><TextApp size="sm" color={theme.colors.text.secondary}>No hay alumnos matriculados en esta aula.</TextApp></View>}
                </View>
            ) : tab === 'announcements' ? (
                <View style={styles.content}>
                    <View style={styles.sectionHeading}><View style={{ flex: 1 }}><TextApp size="lg" variant="semibold">Anuncios del curso</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Mensajes visibles para el aula</TextApp></View><Button size="sm" onPress={() => setShowAnnouncementForm((value) => !value)}>{showAnnouncementForm ? 'Cerrar' : 'Nuevo'}</Button></View>
                    {showAnnouncementForm && <View style={styles.form}><TextApp size="md" variant="semibold">Publicar anuncio</TextApp><Input label="Título" placeholder="Ej. Material para la próxima clase" value={title} onChangeText={setTitle} maxLength={120} /><Input label="Mensaje" placeholder="Escribe la noticia para alumnos y familias" value={body} onChangeText={setBody} multiline numberOfLines={4} minHeight={100} maxLength={3000} showCharacterCount /><Button fullWidth icon={Save} loading={savingAnnouncement} onPress={publishAnnouncement}>Publicar para el curso</Button></View>}
                    {loadingAnnouncements ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 24 }} /> : announcements.length ? announcements.map((announcement) => (
                        <View key={announcement.id} style={styles.announcement}><View style={styles.announcementIcon}><Bell size={17} color={theme.colors.primary[800]} /></View><View style={{ flex: 1, gap: 5 }}><TextApp size="sm" variant="semibold">{announcement.title}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{announcement.body}</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>{formatDate(announcement.visible_from || announcement.created_at)}</TextApp></View></View>
                    )) : <View style={styles.empty}><Megaphone size={22} color={theme.colors.primary[700]} /><TextApp size="sm" color={theme.colors.text.secondary}>Todavía no hay anuncios. Publica el primero para este curso.</TextApp></View>}
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.sectionHeading}><View><TextApp size="lg" variant="semibold">Calificaciones</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Evaluaciones de este curso y aula</TextApp></View><Button size="sm" variant="outline" onPress={() => router.push('/(tabs)/assessments')}>Nueva</Button></View>
                    {assessments.length ? assessments.map((assessment) => (
                        <Pressable key={assessment.id} onPress={() => router.push({ pathname: '/(tabs)/assessment/[id]', params: { id: assessment.id } })} style={styles.assessment} accessibilityRole="button" accessibilityLabel={`Ingresar notas de ${assessment.title}`}>
                            <View style={styles.assessmentIcon}><CalendarDays size={18} color={theme.colors.primary[800]} /></View><View style={{ flex: 1, gap: 4 }}><TextApp size="sm" variant="semibold">{assessment.title}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{formatDate(assessment.assessment_date)} · {assessment.gradedCount} notas ingresadas</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>Puntaje máximo: {assessment.maximum_score}</TextApp></View><TextApp size="xs" variant="semibold" color={theme.colors.primary[800]}>Subir notas</TextApp>
                        </Pressable>
                    )) : <View style={styles.empty}><CalendarDays size={22} color={theme.colors.primary[700]} /><TextApp size="sm" color={theme.colors.text.secondary} align="center">Aún no hay evaluaciones creadas para este curso.</TextApp><Button size="sm" variant="outline" onPress={() => router.push('/(tabs)/assessments')}>Crear evaluación</Button></View>}
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: 18 },
    back: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    tabScroller: { marginHorizontal: 16, flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle },
    tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 3 },
    activeTab: { backgroundColor: theme.colors.primary[100] },
    content: { paddingHorizontal: 20, gap: 11 },
    hero: { padding: 18, borderRadius: 18, backgroundColor: theme.colors.primary[100], gap: 4, marginBottom: 3 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 15, borderRadius: 15 },
    studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 12 },
    number: { width: 32, height: 32, borderRadius: 11, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
    form: { gap: 12, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 15, backgroundColor: '#fff' },
    announcement: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 14 },
    announcementIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    assessment: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 12 },
    assessmentIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    empty: { marginTop: 8, padding: 22, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.border.subtle },
});
