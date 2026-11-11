import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, GraduationCap, Users, UserRound, Send, Search } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SelectField from '../../components/ui/SelectField';
import { useAuth } from '../../context/AuthContext';
import { getAssistantStudents } from '../../services/assistantServices';
import { theme } from '../../constants/theme';

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const levelLabel = (value) => ({ INITIAL: 'Inicial', PRIMARY: 'Primaria', SECONDARY: 'Secundaria' }[String(value || '').toUpperCase()] || value || 'Sin nivel');

export default function AssistantGroups() {
    const { staff } = useAuth();
    const institutionId = staff?.institutionId;
    const membershipId = staff?.membershipId;
    const [students, setStudents] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [classroomFilter, setClassroomFilter] = useState('ALL');
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [selected, setSelected] = useState([]);

    const load = useCallback(async () => {
        if (!institutionId || !membershipId) return;
        try {
            const result = await getAssistantStudents({ institutionId, membershipId });
            setStudents(result.students);
            setClassrooms(result.classrooms);
            setError('');
        } catch (e) { setError(e.message || 'No se pudo cargar la supervisión institucional.'); }
    }, [institutionId, membershipId]);

    useEffect(() => {
        let active = true;
        const run = async () => { await load(); if (active) setLoading(false); };
        run();
        return () => { active = false; };
    }, [load]);

    const levels = useMemo(() => [...new Set(classrooms.map((item) => item.level).filter(Boolean))].sort(), [classrooms]);
    const hasStudentCriteria = search.trim().length >= 2 || classroomFilter !== 'ALL' || levelFilter !== 'ALL';
    const filtered = useMemo(() => {
        if (!hasStudentCriteria) return [];
        return students.filter((student) => {
            const matchesSearch = !search.trim() || normalize([student.full_name, student.student_code, student.classroom_name].join(' ')).includes(normalize(search));
            const matchesClass = classroomFilter === 'ALL' || student.classroom_id === classroomFilter;
            const matchesLevel = levelFilter === 'ALL' || student.level === levelFilter;
            return matchesSearch && matchesClass && matchesLevel;
        }).slice(0, 50);
    }, [students, search, classroomFilter, levelFilter, hasStudentCriteria]);
    const classroomOptions = useMemo(() => [
        { value: 'ALL', label: 'Todos los salones' },
        ...classrooms.map((item) => ({ value: item.id, label: [item.label, levelLabel(item.level)].filter(Boolean).join(' · ') })),
    ], [classrooms]);
    const levelOptions = useMemo(() => [
        { value: 'ALL', label: 'Todos los niveles' },
        ...levels.map((level) => ({ value: level, label: levelLabel(level) })),
    ], [levels]);

    async function refresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }
    function toggleStudent(id) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
    function openStudent(student) {
        router.push({ pathname: '/student/[id]', params: {
            id: student.id, classroomId: student.classroom_id, enrollmentId: student.enrollment_id,
            academicYearId: student.academic_year_id, classroomName: student.classroom_name, assistantMode: 'true',
        } });
    }
    function createForSelection() {
        router.push({ pathname: '/(tabs)/assistant-reports', params: { studentIds: JSON.stringify(selected), targetType: 'STUDENTS' } });
    }
    function selectVisible() {
        const visibleIds = filtered.map((item) => item.id);
        setSelected((current) => [...new Set([...current, ...visibleIds])]);
    }

    return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
        <View style={s.header}>
            <TextApp size="2xl" variant="bold">Supervisión de alumnos</TextApp>
            <TextApp size="sm" color={theme.colors.text.secondary}>Acceso institucional a todos los alumnos activos, sin limitarte a aulas asignadas</TextApp>
        </View>
        <View style={s.search}><Input type="search" value={search} onChangeText={setSearch} placeholder="Buscar por nombre, apellido o código" /></View>
        {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ marginTop: 35 }} /> : <>
            {!!error && <View style={s.empty}><TextApp size="sm" color={theme.colors.state.error}>{error}</TextApp><Button size="sm" variant="outline" onPress={load}>Reintentar</Button></View>}
            {!error && <>
                <View style={s.metrics}>
                    <View style={s.metric}><Users size={18} color={theme.colors.primary[700]} /><TextApp size="lg" variant="bold">{students.length}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Alumnos activos</TextApp></View>
                    <View style={s.metric}><GraduationCap size={18} color={theme.colors.primary[700]} /><TextApp size="lg" variant="bold">{classrooms.length}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Salones</TextApp></View>
                    <View style={s.metric}><Check size={18} color={theme.colors.primary[700]} /><TextApp size="lg" variant="bold">{selected.length}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Seleccionados</TextApp></View>
                </View>
                <View style={s.filters}>
                    <SelectField label="Salón" value={classroomFilter} onChange={setClassroomFilter} options={classroomOptions} />
                    <SelectField label="Nivel" value={levelFilter} onChange={setLevelFilter} options={levelOptions} />
                </View>
                <View style={s.listHeader}>
                    <View><TextApp size="md" variant="semibold">Alumnos</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{hasStudentCriteria ? `${filtered.length} resultados mostrados` : "Busca o selecciona filtros para consultar"}</TextApp></View>
                    {hasStudentCriteria && filtered.length > 0 ? <Pressable onPress={selectVisible}><TextApp size="xs" variant="semibold" color={theme.colors.primary[700]}>Seleccionar visibles</TextApp></Pressable> : null}
                </View>
                <View style={s.list}>
                    {filtered.map((student) => {
                        const isSelected = selected.includes(student.id);
                        return <View key={student.id} style={s.studentCard}>
                            <Pressable onPress={() => toggleStudent(student.id)} style={[s.selectBox, isSelected && s.selectBoxActive]}>{isSelected && <Check size={15} color="#fff" />}</Pressable>
                            <Pressable style={s.studentMain} onPress={() => openStudent(student)}>
                                <View style={s.avatar}><UserRound size={18} color={theme.colors.primary[700]} /></View>
                                <View style={{ flex: 1, gap: 3 }}>
                                    <TextApp size="sm" variant="semibold">{student.full_name}</TextApp>
                                    <TextApp size="xs" color={theme.colors.text.secondary}>{student.student_code || 'Sin código'} · {student.classroom_name || 'Sin salón'}</TextApp>
                                </View>
                                <ChevronRight size={18} color={theme.colors.text.tertiary} />
                            </Pressable>
                        </View>;
                    })}
                    {!filtered.length && <View style={s.empty}><Search size={26} color={theme.colors.primary[700]} /><TextApp size="md" variant="semibold">{!students.length ? 'No hay alumnos activos' : hasStudentCriteria ? 'Sin resultados' : 'Busca un alumno'}</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">{!students.length ? 'Cuando existan matrículas activas, aparecerán aquí.' : hasStudentCriteria ? 'Prueba con otro nombre, código o filtro.' : 'Escribe al menos 2 caracteres o selecciona un salón o nivel. Mostraremos hasta 50 coincidencias.'}</TextApp></View>}
                </View>
                {!!selected.length && <View style={s.bottomAction}>
                    <Button fullWidth icon={Send} onPress={createForSelection}>Crear comunicación para {selected.length} alumno(s)</Button>
                    <Button fullWidth size="sm" variant="ghost" onPress={() => setSelected([])}>Limpiar selección</Button>
                </View>}
            </>}
        </>}
    </Screen>;
}

const s=StyleSheet.create({
    header:{paddingHorizontal:20,paddingTop:22,gap:5},
    search:{paddingHorizontal:20,paddingTop:12},
    metrics:{marginHorizontal:20,marginTop:16,flexDirection:'row',gap:8},
    metric:{flex:1,padding:12,borderRadius:15,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',gap:4},
    filters:{paddingHorizontal:20,paddingTop:18,gap:9},
    filterRow:{flexDirection:'row',gap:8},
    listHeader:{paddingHorizontal:20,paddingTop:19,paddingBottom:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    list:{paddingHorizontal:20,gap:8,paddingBottom:22},
    studentCard:{padding:10,borderRadius:15,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,flexDirection:'row',alignItems:'center',gap:10},
    selectBox:{width:24,height:24,borderRadius:7,borderWidth:1.5,borderColor:theme.colors.border.DEFAULT,alignItems:'center',justifyContent:'center'},
    selectBoxActive:{backgroundColor:theme.colors.primary[700],borderColor:theme.colors.primary[700]},
    studentMain:{flex:1,flexDirection:'row',alignItems:'center',gap:10},
    avatar:{width:38,height:38,borderRadius:12,backgroundColor:theme.colors.primary[50],alignItems:'center',justifyContent:'center'},
    empty:{marginVertical:14,padding:24,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',gap:9},
    bottomAction:{paddingHorizontal:20,paddingTop:10,paddingBottom:16,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:theme.colors.border.subtle,gap:4},
});
