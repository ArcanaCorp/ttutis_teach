import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronRight, GraduationCap, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import { useAuth } from '../../context/AuthContext';
import { getTeacherSchedule } from '../../services/staffServices';
import { theme } from '../../constants/theme';

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Schedule() {
    const { session, staff } = useAuth();
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        return staff?.role === 'TEACHER' && staff.institutionId
            ? await getTeacherSchedule({ userId: session?.user?.id, institutionId: staff.institutionId, membershipId: staff.membershipId })
            : [];
    }, [session, staff]);

    useEffect(() => {
        let active = true;
        load().then((items) => { if (active) setSchedule(items); })
            .catch(() => { if (active) setSchedule([]); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [load]);

    async function refresh() {
        setRefreshing(true);
        try { setSchedule(await load()); } finally { setRefreshing(false); }
    }

    const grouped = days.map((label, index) => ({ label, classes: schedule.filter((item) => Number(item.weekday) === index + 1) })).filter((day) => day.classes.length);

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} /> }>
            <View style={styles.header}><TextApp size="2xl" variant="bold">Mi horario</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Tus clases y aulas asignadas</TextApp></View>
            {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 28 }} /> : grouped.length ? grouped.map((day) => (
                <View key={day.label} style={styles.dayGroup}>
                    <TextApp size="md" variant="semibold">{day.label}</TextApp>
                    {day.classes.map((item) => (
                        <Pressable key={item.id} style={styles.classCard} onPress={() => router.push({ pathname: '/class/[id]', params: { id: item.id, context: JSON.stringify(item) } })} accessibilityRole="button" accessibilityLabel={`Ver detalles de ${item.subject}`}>
                            <View style={styles.time}><TextApp size="sm" variant="semibold">{item.start_time?.slice(0, 5)}</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>{item.end_time?.slice(0, 5)}</TextApp></View>
                            <View style={styles.details}>
                                <TextApp size="md" variant="semibold">{item.subject}</TextApp>
                                <View style={styles.detailRow}><GraduationCap size={14} color={theme.colors.text.tertiary} /><TextApp size="xs" color={theme.colors.text.secondary}>{item.section}</TextApp></View>
                                {!!item.classroom && <View style={styles.detailRow}><MapPin size={14} color={theme.colors.text.tertiary} /><TextApp size="xs" color={theme.colors.text.secondary}>{item.classroom}</TextApp></View>}
                            </View>
                            <ChevronRight size={18} color={theme.colors.text.tertiary} />
                        </Pressable>
                    ))}
                </View>
            )) : (
                <View style={styles.empty}>
                    <CalendarDays size={26} color={theme.colors.primary[700]} />
                    <TextApp size="md" variant="semibold">Todavía no hay horario asignado</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary} align="center">{staff?.role === 'ASSISTANT' ? 'Las aulas y turnos asignados por tu institución aparecerán aquí.' : 'Cuando la institución registre tus clases, podrás consultarlas aquí.'}</TextApp>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8, gap: 4 },
    dayGroup: { paddingHorizontal: 20, gap: 10, marginTop: 12 },
    classCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: 14 },
    time: { minWidth: 52, gap: 4 },
    details: { flex: 1, gap: 5 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    empty: { marginHorizontal: 20, marginTop: 24, alignItems: 'center', gap: 10, padding: 26, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle },
});
