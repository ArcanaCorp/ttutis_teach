import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronRight, Clock3, GraduationCap, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import Screen from '../../components/ui/Screen';
import { ScheduleSkeleton } from '../../components/ui/Skeleton';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import TextApp from '../../components/ui/TextApp';
import { useAuth } from '../../context/AuthContext';
import { getTeacherSchedule } from '../../services/staffServices';
import { theme } from '../../constants/theme';
import AssistantHome from '../../components/assistant/AssistantHome';

const weekdayLabels = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function formatTime(value) { return value ? value.slice(0, 5) : ''; }

export default function Home() {
    const { session, staff, staffLoading } = useAuth();
    if (staff?.role === 'ASSISTANT') return <AssistantHome />;
    const today = useMemo(() => new Date(), []);
    const todayLabel = `${weekdayLabels[today.getDay()]}, ${today.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}`;
    const loadSchedule = useCallback(() => staff?.role === 'TEACHER' && staff.institutionId
        ? getTeacherSchedule({ userId: session?.user?.id, institutionId: staff.institutionId, membershipId: staff.membershipId })
        : Promise.resolve([]), [session, staff]);
    const cacheKey = `schedule:${session?.user?.id || 'guest'}:${staff?.institutionId || 'none'}`;
    const { data, loading, refreshing, refresh } = useCachedQuery(cacheKey, loadSchedule, 15 * 60 * 1000, !staffLoading);
    const schedule = data || [];
    const todaysClasses = schedule.filter((item) => Number(item.weekday) === (today.getDay() || 7));
    const firstName = staff?.displayName?.split(' ')[0] || 'Hola';
    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
            <View style={styles.header}><View style={styles.greeting}><TextApp size="2xl" variant="bold">Hola, {firstName}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{staff?.institutionName || 'Tu espacio de trabajo TTUTIS'}</TextApp></View><View style={styles.roleChip}><TextApp size="xs" variant="semibold">Docente</TextApp></View></View>
            <View style={styles.content}>
                <View style={styles.dateRow}><CalendarDays size={17} color={theme.colors.primary[700]} /><TextApp size="sm" variant="medium" textTransform="capitalize">{todayLabel}</TextApp></View>
                {staff?.loadError && <TextApp size="sm" color={theme.colors.state.error}>No pudimos cargar los datos de tu cuenta. Desliza hacia abajo para volver a intentar.</TextApp>}
                <View style={styles.sectionHeader}><View><TextApp size="xl" variant="bold">Tu jornada</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Clases programadas para hoy</TextApp></View><Pressable onPress={() => router.navigate('/(tabs)/schedule')} style={styles.moreButton}><ChevronRight size={21} color={theme.colors.text.secondary} /></Pressable></View>
                {(staffLoading || (loading && !data)) ? <ScheduleSkeleton count={2} /> : todaysClasses.length ? <View style={styles.classList}>{todaysClasses.map((item) => <View key={item.id} style={styles.classCard}><View style={styles.timeColumn}><TextApp size="sm" variant="semibold">{formatTime(item.start_time)}</TextApp><View style={styles.timeLine} /><TextApp size="xs" color={theme.colors.text.tertiary}>{formatTime(item.end_time)}</TextApp></View><View style={styles.classInfo}><TextApp size="md" variant="semibold">{item.subject}</TextApp><View style={styles.detailRow}><GraduationCap size={14} color={theme.colors.text.tertiary} /><TextApp size="xs" color={theme.colors.text.secondary}>{item.section}</TextApp></View>{!!item.classroom && <View style={styles.detailRow}><MapPin size={14} color={theme.colors.text.tertiary} /><TextApp size="xs" color={theme.colors.text.secondary}>{item.classroom}</TextApp></View>}</View><Clock3 size={17} color={theme.colors.primary[700]} /></View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><CalendarDays size={22} color={theme.colors.primary[700]} /></View><TextApp size="md" variant="semibold">Aún no hay clases para mostrar</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">El horario aparecerá aquí cuando la institución complete tu asignación.</TextApp></View>}
                <View style={styles.infoCard}><TextApp size="md" variant="semibold" color={theme.colors.primary[950]}>Todo listo para tu jornada</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Consulta tu horario y la información de tu cuenta desde las pestañas inferiores.</TextApp></View>
            </View>
        </Screen>
    );
}
const styles = StyleSheet.create({
 header:{paddingHorizontal:20,paddingTop:20,paddingBottom:18,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle,flexDirection:'row',alignItems:'center',gap:12},greeting:{flex:1,gap:4},roleChip:{backgroundColor:theme.colors.primary[100],paddingHorizontal:11,paddingVertical:7,borderRadius:20},content:{paddingHorizontal:20,paddingTop:20,gap:20},dateRow:{flexDirection:'row',alignItems:'center',gap:8},sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},moreButton:{width:38,height:38,borderRadius:12,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},classList:{gap:10},classCard:{flexDirection:'row',alignItems:'center',gap:14,padding:15,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle},timeColumn:{alignItems:'center',gap:4,minWidth:46},timeLine:{width:2,height:10,backgroundColor:theme.colors.primary[300],borderRadius:2},classInfo:{flex:1,gap:5},detailRow:{flexDirection:'row',alignItems:'center',gap:5},emptyCard:{alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,borderRadius:20,padding:24},emptyIcon:{width:48,height:48,borderRadius:16,backgroundColor:theme.colors.primary[50],alignItems:'center',justifyContent:'center'},infoCard:{gap:6,borderRadius:18,padding:18,backgroundColor:theme.colors.primary[100],borderWidth:1,borderColor:theme.colors.primary[200]}
});
