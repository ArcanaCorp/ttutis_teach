import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, ClipboardList, Plus, Users } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { createAssessment, getAssessments } from '../../services/academicServices';
import { theme } from '../../constants/theme';

function localDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function Assessments() {
    const { staff } = useAuth();
    const [assessments, setAssessments] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(localDate());
    const [maximumScore, setMaximumScore] = useState('20');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const result = await getAssessments(staff?.institutionId, staff?.membershipId);
        setAssessments(result.assessments);
        setGroups(result.groups);
        setSelectedGroup((current) => current || result.groups[0] || null);
        setError(result.error);
    }, [staff?.institutionId, staff?.membershipId]);

    useEffect(() => {
        let active = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loading synchronizes this screen with Supabase.
        load().catch(() => setError('No se pudieron cargar las evaluaciones.'))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [load]);

    async function refresh() {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    }

    async function save() {
        if (!selectedGroup || !title.trim() || !date || Number(maximumScore) <= 0) {
            setError('Completa el aula, el título, la fecha y el puntaje máximo.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await createAssessment({
                institutionId: staff.institutionId,
                membershipId: staff.membershipId,
                group: selectedGroup,
                title,
                description,
                date,
                maximumScore,
            });
            setTitle('');
            setDescription('');
            setDate(localDate());
            setShowForm(false);
            await load();
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
            <View style={styles.header}>
                <View style={styles.titleRow}><View style={styles.icon}><ClipboardList size={21} color={theme.colors.primary[800]} /></View><View style={{ flex: 1 }}><TextApp size="2xl" variant="bold">Evaluaciones</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Fechas de exámenes y notas</TextApp></View></View>
                <Button size="sm" icon={Plus} onPress={() => setShowForm((value) => !value)}>{showForm ? 'Cerrar' : 'Nuevo examen'}</Button>
            </View>

            {showForm && (
                <View style={styles.form}>
                    <TextApp size="lg" variant="semibold">Programar examen</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary}>Selecciona el curso y define la fecha.</TextApp>
                    {!groups.length ? <TextApp size="sm" color={theme.colors.text.secondary}>No tienes cursos asignados para crear evaluaciones.</TextApp> : (
                        <View style={styles.groupList}>{groups.map((group) => (
                            <Pressable key={group.id} style={[styles.groupChip, selectedGroup?.id === group.id && styles.groupSelected]} onPress={() => setSelectedGroup(group)}>
                                <TextApp size="xs" variant="medium" color={selectedGroup?.id === group.id ? theme.colors.primary[950] : theme.colors.text.secondary}>{group.label}</TextApp>
                            </Pressable>
                        ))}</View>
                    )}
                    <Input label="Título" placeholder="Examen bimestral" value={title} onChangeText={setTitle} maxLength={120} />
                    <Input label="Descripción" placeholder="Temas incluidos, materiales..." value={description} onChangeText={setDescription} multiline numberOfLines={3} minHeight={84} />
                    <View style={styles.inlineInputs}>
                        <View style={{ flex: 1 }}><Input label="Fecha (AAAA-MM-DD)" placeholder="2026-11-20" value={date} onChangeText={setDate} autoCapitalize="none" /></View>
                        <View style={{ width: 100 }}><Input label="Puntaje máx." value={maximumScore} onChangeText={setMaximumScore} keyboardType="decimal-pad" /></View>
                    </View>
                    {!!error && <TextApp size="xs" color={theme.colors.state.error}>{error}</TextApp>}
                    <Button fullWidth loading={saving} disabled={!groups.length} onPress={save}>Guardar examen</Button>
                </View>
            )}

            <View style={styles.listHeader}><Users size={18} color={theme.colors.primary[700]} /><TextApp size="lg" variant="semibold">Próximos exámenes</TextApp></View>
            {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 26 }} /> : error && !showForm ? <View style={styles.empty}><TextApp size="sm" color={theme.colors.state.error}>{error}</TextApp></View> : assessments.length ? assessments.map((item) => (
                <Pressable key={item.id} style={styles.assessmentCard} onPress={() => router.push({ pathname: '/(tabs)/assessment/[id]', params: { id: item.id } })}>
                    <View style={styles.dateBox}><TextApp size="xs" variant="semibold">{new Date(`${item.assessment_date}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</TextApp></View>
                    <View style={{ flex: 1, gap: 4 }}>
                        <TextApp size="md" variant="semibold">{item.title}</TextApp>
                        <TextApp size="xs" color={theme.colors.text.secondary}>{item.classroom?.grade_label} {item.classroom?.section_name} · {item.gradedCount} notas ingresadas</TextApp>
                        <TextApp size="xs" color={theme.colors.text.tertiary}>Puntaje máximo: {item.maximum_score}</TextApp>
                    </View>
                    <ChevronRight size={18} color={theme.colors.text.tertiary} />
                </Pressable>
            )) : <View style={styles.empty}><CalendarDays size={23} color={theme.colors.primary[700]} /><TextApp size="md" variant="semibold">Aún no tienes exámenes</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">Programa una fecha y registra las notas cuando rindan la evaluación.</TextApp></View>}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    form: { marginHorizontal: 20, padding: 17, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, gap: 12 },
    groupList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    groupChip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: theme.colors.background.subtle, borderWidth: 1, borderColor: theme.colors.border.subtle },
    groupSelected: { backgroundColor: theme.colors.primary[100], borderColor: theme.colors.primary[400] },
    inlineInputs: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
    assessmentCard: { marginHorizontal: 20, padding: 14, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: theme.colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateBox: { width: 52, height: 52, borderRadius: 15, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    empty: { marginHorizontal: 20, padding: 22, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', gap: 9 },
});
