import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronRight, GraduationCap, Users, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { getAssistantGroups } from '../../services/assistantServices';
import { theme } from '../../constants/theme';

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export default function AssistantGroups() {
    const { staff } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState({});
    const load = useCallback(async () => {
        if (!staff?.institutionId || !staff?.membershipId) return;
        setError('');
        try { setGroups(await getAssistantGroups({ institutionId: staff.institutionId, membershipId: staff.membershipId })); }
        catch (e) { setError(e.message || 'No se pudieron cargar tus grupos.'); }
    }, [staff?.institutionId, staff?.membershipId]);
    useEffect(() => { let active = true; load().finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);
    const filtered = useMemo(() => groups.map((group) => ({ ...group, students: group.students.filter((student) => normalize([student.name, student.code].join(' ')).includes(normalize(search))) })).filter((group) => !search || group.students.length || normalize(group.label).includes(normalize(search))), [groups, search]);
    async function refresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }
    function openStudent(student, group) {
        router.push({ pathname: '/student/[id]', params: { id: student.id, classroomId: group.classroomId, enrollmentId: student.enrollmentId, academicYearId: group.academicYearId, classroomName: group.label, assistantMode: 'true' } });
    }
    return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
        <View style={s.header}><TextApp size="2xl" variant="bold">Mis grupos</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Aulas asignadas para seguimiento</TextApp></View>
        <View style={s.search}><Input type="search" value={search} onChangeText={setSearch} placeholder="Buscar grupo o alumno" /></View>
        {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ marginTop: 35 }} /> : !!error ? <View style={s.empty}><TextApp size="sm" color={theme.colors.state.error}>{error}</TextApp><Button size="sm" variant="outline" onPress={load}>Reintentar</Button></View> : <>
            <View style={s.count}><Users size={17} color={theme.colors.primary[700]} /><TextApp size="sm" variant="medium">{groups.length} grupos · {groups.reduce((sum, group) => sum + group.studentCount, 0)} alumnos</TextApp></View>
            <View style={s.list}>{filtered.map((group) => <View key={group.id} style={s.card}>
                <Pressable onPress={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))} style={s.groupHeader}>
                    <View style={s.icon}><GraduationCap size={21} color={theme.colors.primary[800]} /></View>
                    <View style={{ flex: 1, gap: 3 }}><TextApp size="md" variant="semibold">{group.label}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{group.studentCount} alumnos · {group.level || 'Nivel no especificado'}</TextApp></View>
                    {expanded[group.id] ? <ChevronDown size={20} color={theme.colors.text.secondary} /> : <ChevronRight size={20} color={theme.colors.text.secondary} />}
                </Pressable>
                {expanded[group.id] && <View style={s.students}>{group.students.map((student) => <Pressable key={student.id} onPress={() => openStudent(student, group)} style={s.student}>
                    <View style={s.avatar}><UserRound size={17} color={theme.colors.primary[700]} /></View><View style={{ flex: 1, gap: 2 }}><TextApp size="sm" variant="medium">{student.name}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{student.code || 'Sin código'}</TextApp></View><ChevronRight size={17} color={theme.colors.text.tertiary} />
                </Pressable>)}{!group.students.length && <TextApp size="sm" color={theme.colors.text.tertiary}>No hay alumnos que coincidan con la búsqueda.</TextApp>}</View>}
            </View>)}
            {!filtered.length && <View style={s.empty}><Users size={28} color={theme.colors.primary[700]} /><TextApp size="md" variant="semibold">{search ? 'Sin resultados' : 'Aún no tienes grupos asignados'}</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">{search ? 'Prueba con otro nombre o grupo.' : 'La institución debe asignarte aulas para que puedas hacer seguimiento. Esta asignación no limita el registro de asistencia institucional.'}</TextApp></View>}
        </>}
    </Screen>;
}
const s=StyleSheet.create({header:{paddingHorizontal:20,paddingTop:22,gap:4},search:{paddingHorizontal:20,paddingTop:8},count:{paddingHorizontal:22,flexDirection:'row',alignItems:'center',gap:8},list:{paddingHorizontal:20,gap:10},card:{backgroundColor:'#fff',borderRadius:17,borderWidth:1,borderColor:theme.colors.border.subtle,overflow:'hidden'},groupHeader:{padding:14,flexDirection:'row',alignItems:'center',gap:11},icon:{width:44,height:44,borderRadius:14,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'},students:{paddingHorizontal:14,paddingBottom:10,borderTopWidth:1,borderTopColor:theme.colors.border.subtle},student:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11,borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle},avatar:{width:34,height:34,borderRadius:11,backgroundColor:theme.colors.primary[50],alignItems:'center',justifyContent:'center'},empty:{margin:20,padding:25,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',gap:10}});
