import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FileText, Plus, ChevronDown, ChevronUp, UserRound, X } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { getAssistantGroups, getAssistantReports, createAssistantReport } from '../../services/assistantServices';
import { theme } from '../../constants/theme';

const priorities = [{ value: 'LOW', label: 'Baja' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'Alta' }, { value: 'URGENT', label: 'Urgente' }];
const clean = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export default function AssistantReports() {
    const { staff } = useAuth();
    const [groups, setGroups] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [classroomId, setClassroomId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState('NORMAL');

    const load = useCallback(async () => {
        if (!staff?.institutionId || !staff?.membershipId) return;
        setError('');
        try {
            const [nextGroups, nextReports] = await Promise.all([
                getAssistantGroups({ institutionId: staff.institutionId, membershipId: staff.membershipId }),
                getAssistantReports({ institutionId: staff.institutionId, membershipId: staff.membershipId }),
            ]);
            setGroups(nextGroups);
            setReports(nextReports);
            setClassroomId((current) => current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || '');
        } catch (e) { setError(e.message || 'No se pudo cargar la información.'); }
    }, [staff?.institutionId, staff?.membershipId]);

    useEffect(() => { let active = true; load().finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);
    const selectedGroup = groups.find((group) => group.id === classroomId);
    const filtered = useMemo(() => reports.filter((item) => clean([item.title, item.body, item.studentName, item.studentCode, item.classroomName].join(' ')).includes(clean(search))), [reports, search]);

    async function refresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }
    async function save() {
        if (!classroomId) { Alert.alert('Selecciona un grupo', 'Solo puedes registrar reportes en grupos asignados.'); return; }
        if (!title.trim() || !body.trim()) { Alert.alert('Completa el reporte', 'Agrega un título y describe la incidencia.'); return; }
        setSaving(true);
        try {
            await createAssistantReport({ institutionId: staff.institutionId, membershipId: staff.membershipId, classroomId, studentId: studentId || null, title, body, priority });
            setTitle(''); setBody(''); setStudentId(''); setPriority('NORMAL'); setShowForm(false);
            await load();
            Alert.alert('Reporte registrado', 'El reporte se guardó correctamente.');
        } catch (e) { Alert.alert('No se pudo guardar', e.message); }
        finally { setSaving(false); }
    }

    return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
        <View style={s.header}><TextApp size="2xl" variant="bold">Reportes</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Incidencias y seguimiento de tus grupos asignados</TextApp></View>
        {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ marginTop: 40 }} /> : <>
            {!!error && <View style={s.error}><TextApp size="sm" color={theme.colors.state.error}>{error}</TextApp><Button size="sm" variant="outline" onPress={load}>Reintentar</Button></View>}
            {!showForm ? <>
                <View style={s.summary}><View style={s.summaryIcon}><FileText size={20} color={theme.colors.primary[800]} /></View><View style={{ flex: 1 }}><TextApp size="lg" variant="semibold">{reports.length} reportes</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Registros creados por tu cuenta</TextApp></View><Button size="sm" icon={Plus} onPress={() => setShowForm(true)}>Nuevo</Button></View>
                <View style={s.search}><Input type="search" value={search} onChangeText={setSearch} placeholder="Buscar por alumno, grupo o reporte" /></View>
                <View style={s.list}>{filtered.map((item) => <View key={item.id} style={s.reportCard}>
                    <View style={s.reportTop}><TextApp size="md" variant="semibold" style={{ flex: 1 }}>{item.title}</TextApp><TextApp size="xs" color={item.priority === 'URGENT' || item.priority === 'HIGH' ? theme.colors.state.error : theme.colors.text.tertiary}>{priorities.find((p) => p.value === item.priority)?.label || item.priority}</TextApp></View>
                    <TextApp size="xs" color={theme.colors.text.secondary}>{item.classroomName || 'Grupo'}{item.studentName ? ' · ' + item.studentName : ' · Reporte grupal'}</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary}>{item.body}</TextApp>
                    <TextApp size="xs" color={theme.colors.text.tertiary}>{new Date(item.created_at).toLocaleString('es-PE')}</TextApp>
                </View>)}
                {!filtered.length && <View style={s.empty}><FileText size={28} color={theme.colors.primary[700]} /><TextApp size="md" variant="semibold">{search ? 'No encontramos resultados' : 'Todavía no tienes reportes'}</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">{search ? 'Prueba con otro nombre o palabra.' : 'Cuando registres una incidencia, aparecerá aquí.'}</TextApp></View>}</View>
            </> : <>
                <View style={s.formHeader}><Pressable onPress={() => setShowForm(false)}><X size={22} color={theme.colors.text.primary} /></Pressable><TextApp size="lg" variant="semibold">Nuevo reporte</TextApp></View>
                <View style={s.form}>
                    <TextApp size="sm" variant="semibold">Grupo asignado</TextApp>
                    <View style={s.pickerList}>{groups.map((group) => <Pressable key={group.id} onPress={() => { setClassroomId(group.id); setStudentId(''); }} style={[s.choice, classroomId === group.id && s.choiceActive]}><TextApp size="sm" variant={classroomId === group.id ? 'semibold' : 'regular'}>{group.label}</TextApp></Pressable>)}</View>
                    {!groups.length && <TextApp size="sm" color={theme.colors.text.secondary}>No tienes grupos asignados. Solicita a la institución que te asigne un aula.</TextApp>}
                    <TextApp size="sm" variant="semibold">Alumno (opcional)</TextApp>
                    <View style={s.pickerList}><Pressable onPress={() => setStudentId('')} style={[s.choice, !studentId && s.choiceActive]}><TextApp size="sm">Todo el grupo</TextApp></Pressable>{(selectedGroup?.students || []).map((student) => <Pressable key={student.id} onPress={() => setStudentId(student.id)} style={[s.choice, studentId === student.id && s.choiceActive]}><TextApp size="sm">{student.name}</TextApp></Pressable>)}</View>
                    <Input label="Título" value={title} onChangeText={setTitle} placeholder="Ej. Incidencia durante el recreo" maxLength={120} />
                    <Input label="Detalle" value={body} onChangeText={setBody} type="multiline" multiline numberOfLines={5} placeholder="Describe lo ocurrido de forma clara y objetiva." maxLength={3000} />
                    <TextApp size="sm" variant="semibold">Prioridad</TextApp>
                    <View style={s.priorityRow}>{priorities.map((p) => <Pressable key={p.value} onPress={() => setPriority(p.value)} style={[s.priority, priority === p.value && s.choiceActive]}><TextApp size="xs" variant={priority === p.value ? 'semibold' : 'regular'}>{p.label}</TextApp></Pressable>)}</View>
                    <Button loading={saving} disabled={!groups.length || saving} onPress={save} block>Guardar reporte</Button>
                </View>
            </>}
        </>}
    </Screen>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:20,paddingTop:22,gap:4},summary:{marginHorizontal:20,marginTop:20,padding:16,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,flexDirection:'row',alignItems:'center',gap:12},summaryIcon:{width:44,height:44,borderRadius:14,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'},search:{paddingHorizontal:20,paddingTop:18},list:{paddingHorizontal:20,gap:10},reportCard:{padding:15,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,gap:8},reportTop:{flexDirection:'row',alignItems:'center',gap:8},empty:{margin:20,padding:26,borderRadius:18,backgroundColor:'#fff',alignItems:'center',gap:10,borderWidth:1,borderColor:theme.colors.border.subtle},formHeader:{marginHorizontal:20,marginTop:20,flexDirection:'row',alignItems:'center',gap:14},form:{margin:20,marginTop:12,padding:17,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,gap:13},pickerList:{gap:7},choice:{padding:12,borderRadius:12,borderWidth:1,borderColor:theme.colors.border.subtle,backgroundColor:'#fff'},choiceActive:{borderColor:theme.colors.primary[600],backgroundColor:theme.colors.primary[50]},priorityRow:{flexDirection:'row',flexWrap:'wrap',gap:7},priority:{paddingHorizontal:13,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:theme.colors.border.subtle},error:{margin:20,padding:14,backgroundColor:'#fff',borderRadius:14,gap:10}
});
