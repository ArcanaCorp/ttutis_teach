import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FileText, Plus, X, Users, UserRound, GraduationCap, Megaphone, Check } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SelectField from '../../components/ui/SelectField';
import { useAuth } from '../../context/AuthContext';
import { getAssistantStudents, getAssistantReports, createAssistantReport } from '../../services/assistantServices';
import { theme } from '../../constants/theme';

const priorities = [{ value: 'LOW', label: 'Baja' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'Alta' }, { value: 'URGENT', label: 'Urgente' }];
const types = [
    { value: 'REPORT', label: 'Reporte', description: 'Registro general' },
    { value: 'BEHAVIOR', label: 'Incidencia', description: 'Llamada de atención' },
    { value: 'CITATION', label: 'Citación', description: 'Convocar a padres' },
    { value: 'ANNOUNCEMENT', label: 'Anuncio', description: 'Comunicación' },
    { value: 'RECOMMENDATION', label: 'Seguimiento', description: 'Recomendación' },
    { value: 'NOTIFICATION', label: 'Notificación', description: 'Aviso puntual' },
];
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const priorityLabel = (value) => priorities.find((item) => item.value === value)?.label || value;
const typeLabel = (value) => types.find((item) => item.value === value)?.label || value;

export default function AssistantReports() {
    const { staff } = useAuth();
    const institutionId = staff?.institutionId;
    const membershipId = staff?.membershipId;
    const params = useLocalSearchParams();
    const routeApplied = useRef(false);
    const routeStudentIds = useMemo(() => {
        try {
            const raw = Array.isArray(params.studentIds) ? params.studentIds[0] : params.studentIds;
            const parsed = raw ? JSON.parse(String(raw)) : [];
            return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
        } catch { return []; }
    }, [params.studentIds]);
    const [students, setStudents] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(Boolean(params.studentIds || params.studentId));
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [recipientSearch, setRecipientSearch] = useState('');
    const [recipientClassroomId, setRecipientClassroomId] = useState('ALL');
    const [targetType, setTargetType] = useState('STUDENTS');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [classroomId, setClassroomId] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState('NORMAL');
    const [updateType, setUpdateType] = useState('REPORT');

    const load = useCallback(async () => {
        if (!institutionId || !membershipId) return;
        try {
            const [directory, nextReports] = await Promise.all([
                getAssistantStudents({ institutionId, membershipId }),
                getAssistantReports({ institutionId, membershipId }),
            ]);
            setStudents(directory.students);
            setClassrooms(directory.classrooms);
            setReports(nextReports);
            setError('');
            if (!routeApplied.current) {
                routeApplied.current = true;
                if (routeStudentIds.length) setSelectedStudentIds(routeStudentIds);
                else if (params.studentId) setSelectedStudentIds([String(params.studentId)]);
                if (params.classroomId) {
                    setClassroomId(String(params.classroomId));
                    if (!routeStudentIds.length && !params.studentId) setTargetType('CLASSROOM');
                }
                if (params.targetType === 'STUDENTS') setTargetType('STUDENTS');
            }
        } catch (e) { setError(e.message || 'No se pudo cargar la información.'); }
    }, [institutionId, membershipId, routeStudentIds, params.studentId, params.classroomId, params.targetType]);

    useEffect(() => {
        let active = true;
        const run = async () => { await load(); if (active) setLoading(false); };
        run();
        return () => { active = false; };
    }, [load]);

    const filteredReports = useMemo(() => reports.filter((item) =>
        normalize([item.title, item.body, item.studentName, item.studentCode, item.classroomName, typeLabel(item.update_type)].join(' ')).includes(normalize(search))
    ), [reports, search]);
    const groupedReports = useMemo(() => {
        const groups = new Map();
        filteredReports.forEach((item) => {
            const key = [item.title, item.body, item.update_type, item.priority, item.created_at].join('|');
            const current = groups.get(key) || { ...item, recipients: 0 };
            current.recipients += 1;
            groups.set(key, current);
        });
        return [...groups.values()];
    }, [filteredReports]);
    const visibleStudents = useMemo(() => {
        const query = normalize(recipientSearch.trim());
        if (query.length < 2) return [];
        return students.filter((student) => {
            const matchesSearch = normalize([student.full_name, student.student_code, student.classroom_name].join(' ')).includes(query);
            const matchesClassroom = recipientClassroomId === 'ALL' || student.classroom_id === recipientClassroomId;
            return matchesSearch && matchesClassroom;
        }).slice(0, 30);
    }, [students, recipientSearch, recipientClassroomId]);
    const classroomOptions = useMemo(() => [
        { value: 'ALL', label: 'Todos los salones' },
        ...classrooms.map((item) => ({ value: item.id, label: [item.label, item.level].filter(Boolean).join(' · ') })),
    ], [classrooms]);

    async function refresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }
    function toggleStudent(id) {
        setSelectedStudentIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    }
    function resetForm() {
        setTitle(''); setBody(''); setPriority('NORMAL'); setUpdateType('REPORT');
        setSelectedStudentIds([]); setClassroomId(''); setTargetType('STUDENTS');
        setRecipientSearch(''); setRecipientClassroomId('ALL');
    }
    async function save() {
        if (!title.trim() || !body.trim()) { Alert.alert('Completa la comunicación', 'Agrega un título y el detalle.'); return; }
        if (targetType === 'STUDENTS' && !selectedStudentIds.length) { Alert.alert('Selecciona alumnos', 'Puedes escoger uno o varios alumnos de diferentes salones.'); return; }
        if (targetType === 'CLASSROOM' && !classroomId) { Alert.alert('Selecciona un salón', 'Elige el salón que recibirá la comunicación.'); return; }
        setSaving(true);
        try {
            const result = await createAssistantReport({
                institutionId, membershipId, title, body, priority, updateType, targetType,
                studentIds: selectedStudentIds, classroomId,
            });
            resetForm();
            setShowForm(false);
            await load();
            Alert.alert('Comunicación registrada', `Se guardó para ${result.recipientCount || 1} destinatario(s). La app no envió notificaciones push.`);
        } catch (e) { Alert.alert('No se pudo guardar', e.message); }
        finally { setSaving(false); }
    }

    return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary[700]]} />}>
        <View style={s.header}>
            <TextApp size="2xl" variant="bold">Reportes y comunicaciones</TextApp>
            <TextApp size="sm" color={theme.colors.text.secondary}>Incidencias, citaciones, anuncios y seguimiento para toda la institución</TextApp>
        </View>
        {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ marginTop: 40 }} /> : <>
            {!!error && <View style={s.error}><TextApp size="sm" color={theme.colors.state.error}>{error}</TextApp><Button size="sm" variant="outline" onPress={load}>Reintentar</Button></View>}
            <>
                <View style={s.summary}>
                    <View style={s.summaryIcon}><FileText size={20} color={theme.colors.primary[800]} /></View>
                    <View style={{ flex: 1 }}><TextApp size="lg" variant="semibold">{reports.length} registros</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Tus reportes y comunicaciones creados</TextApp></View>
                    <Button size="sm" icon={Plus} onPress={() => setShowForm(true)}>Nuevo</Button>
                </View>
                <View style={s.search}><Input type="search" value={search} onChangeText={setSearch} placeholder="Buscar por título, alumno o tipo" /></View>
                <View style={s.list}>
                    {groupedReports.map((item, index) => <View key={item.id || index} style={s.reportCard}>
                        <View style={s.reportTop}>
                            <TextApp size="md" variant="semibold" style={{ flex: 1 }}>{item.title}</TextApp>
                            <TextApp size="xs" color={item.priority === 'URGENT' || item.priority === 'HIGH' ? theme.colors.state.error : theme.colors.text.tertiary}>{priorityLabel(item.priority)}</TextApp>
                        </View>
                        <View style={s.meta}><TextApp size="xs" variant="semibold" color={theme.colors.primary[700]}>{typeLabel(item.update_type)}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{item.classroomName || 'Institucional'}{item.studentName ? ' · ' + item.studentName : ''}</TextApp></View>
                        <TextApp size="sm" color={theme.colors.text.secondary}>{item.body}</TextApp>
                        {item.recipients > 1 && <TextApp size="xs" color={theme.colors.text.secondary}>Registrado en {item.recipients} destinatarios</TextApp>}
                        <TextApp size="xs" color={theme.colors.text.tertiary}>{new Date(item.created_at).toLocaleString('es-PE')}</TextApp>
                    </View>)}
                    {!groupedReports.length && <View style={s.empty}><FileText size={28} color={theme.colors.primary[700]} /><TextApp size="md" variant="semibold">{search ? 'No encontramos resultados' : 'Todavía no tienes registros'}</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">{search ? 'Prueba con otra palabra.' : 'Crea una citación, anuncio, incidencia o reporte para comenzar.'}</TextApp></View>}
                </View>
            </>
            <Modal visible={showForm} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { setShowForm(false); resetForm(); }}>
                <View style={s.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowForm(false); resetForm(); }} />
                    <KeyboardAvoidingView style={s.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={s.modalCard}>
                            <View style={s.modalHandle} />
                            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
                <View style={s.formHeader}><Pressable onPress={() => { setShowForm(false); resetForm(); }}><X size={22} color={theme.colors.text.primary} /></Pressable><TextApp size="lg" variant="semibold">Nueva comunicación</TextApp></View>
                <View style={s.form}>
                    <View style={s.compactRow}>
                        <View style={{ flex: 1 }}>
                            <SelectField label="Tipo de comunicación" value={updateType} onChange={setUpdateType} options={types.map((item) => ({ value: item.value, label: item.label + ' · ' + item.description }))} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <SelectField label="Prioridad" value={priority} onChange={setPriority} options={priorities} />
                        </View>
                    </View>
                    <SelectField
                        label="Destinatarios"
                        value={targetType}
                        onChange={(value) => { setTargetType(value); setSelectedStudentIds([]); setClassroomId(''); }}
                        options={[
                            { value: 'STUDENTS', label: 'Uno o varios alumnos' },
                            { value: 'CLASSROOM', label: 'Un salón completo' },
                            { value: 'INSTITUTION', label: 'Toda la institución' },
                        ]}
                    />
                    {targetType === 'STUDENTS' && <>
                        <View style={s.recipientHeading}>
                            <TextApp size="sm" variant="semibold">Buscar destinatarios</TextApp>
                            <TextApp size="xs" color={theme.colors.primary[700]}>{selectedStudentIds.length} seleccionados</TextApp>
                        </View>
                        <Input size="sm" type="search" value={recipientSearch} onChangeText={setRecipientSearch} placeholder="Escribe al menos 2 letras o código" />
                        <SelectField label="Filtrar por salón" value={recipientClassroomId} onChange={setRecipientClassroomId} options={classroomOptions} />
                        {!!selectedStudentIds.length && <View style={s.selectedSummary}>
                            <TextApp size="xs" color={theme.colors.text.secondary}>
                                Seleccionados: {students.filter((student) => selectedStudentIds.includes(student.id)).map((student) => student.full_name).join(', ')}
                            </TextApp>
                            <Pressable onPress={() => setSelectedStudentIds([])}><TextApp size="xs" color={theme.colors.state.error}>Limpiar</TextApp></Pressable>
                        </View>}
                        {recipientSearch.trim().length >= 2 ? <View style={s.recipientList}>
                            {visibleStudents.map((student) => {
                                const checked = selectedStudentIds.includes(student.id);
                                return <Pressable key={student.id} onPress={() => toggleStudent(student.id)} style={s.recipientRow}>
                                    <View style={[s.check, checked && s.checkActive]}>{checked && <Check size={12} color="#fff" />}</View>
                                    <View style={{ flex: 1, gap: 1 }}>
                                        <TextApp size="sm" variant="medium">{student.full_name}</TextApp>
                                        <TextApp size="xs" color={theme.colors.text.secondary}>{student.student_code || 'Sin código'} · {student.classroom_name || 'Sin salón'}</TextApp>
                                    </View>
                                </Pressable>;
                            })}
                            {!visibleStudents.length && <TextApp size="xs" color={theme.colors.text.secondary}>No hay coincidencias con ese nombre, código y salón.</TextApp>}
                        </View> : <TextApp size="xs" color={theme.colors.text.tertiary}>La lista no se carga completa. Busca por nombre, apellido o código y selecciona los resultados.</TextApp>}
                    </>}
                    {targetType === 'CLASSROOM' && <>
                        <SelectField
                            label="Salón destinatario"
                            value={classroomId}
                            onChange={setClassroomId}
                            placeholder="Seleccionar salón"
                            options={classrooms.map((item) => ({ value: item.id, label: [item.label, item.level].filter(Boolean).join(' · ') }))}
                        />
                    </>}
                    {targetType === 'INSTITUTION' && <View style={s.institutionNote}><Megaphone size={18} color={theme.colors.primary[700]} /><TextApp size="xs" color={theme.colors.text.secondary}>Se registrará para toda la institución. Los anuncios institucionales quedarán como un único aviso general; los demás tipos se registrarán para cada alumno activo.</TextApp></View>}
                    <Input label="Título" value={title} onChangeText={setTitle} placeholder="Ej. Citación a reunión de padres" maxLength={120} />
                    <Input label="Detalle" value={body} onChangeText={setBody} type="multiline" multiline numberOfLines={5} placeholder="Describe claramente el motivo, fecha, indicaciones y cualquier detalle importante." maxLength={3000} />
                    <Button loading={saving} disabled={saving || !students.length} onPress={save} fullWidth>Guardar comunicación</Button>
                    <TextApp size="xs" color={theme.colors.text.tertiary}>Este registro no dispara SMS, correo ni notificaciones push automáticamente.</TextApp>
                </View>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </>}
    </Screen>;
}

const s=StyleSheet.create({
    header:{paddingHorizontal:20,paddingTop:22,gap:4},
    summary:{marginHorizontal:20,marginTop:20,padding:16,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,flexDirection:'row',alignItems:'center',gap:12},
    summaryIcon:{width:44,height:44,borderRadius:14,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'},
    search:{paddingHorizontal:20,paddingTop:18},
    list:{paddingHorizontal:20,paddingTop:14,gap:10,paddingBottom:24},
    reportCard:{padding:15,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,gap:8},
    reportTop:{flexDirection:'row',alignItems:'center',gap:8},
    meta:{flexDirection:'row',flexWrap:'wrap',gap:7,alignItems:'center'},
    empty:{margin:8,padding:26,borderRadius:18,backgroundColor:'#fff',alignItems:'center',gap:10,borderWidth:1,borderColor:theme.colors.border.subtle},
    formHeader:{marginHorizontal:20,marginTop:8,marginBottom:12,flexDirection:'row',alignItems:'center',gap:14},
    form:{marginHorizontal:12,marginBottom:12,padding:13,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,gap:9},
    compactRow:{flexDirection:'row',gap:9},
    selectedSummary:{padding:9,borderRadius:10,backgroundColor:theme.colors.background.muted,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
    modalOverlay:{flex:1,backgroundColor:'rgba(15,23,42,0.48)',justifyContent:'flex-end'},
    modalKeyboard:{width:'100%',maxHeight:'88%'},
    modalCard:{maxHeight:'100%',backgroundColor:'#fafafa',borderTopLeftRadius:26,borderTopRightRadius:26,paddingTop:10,overflow:'hidden'},
    modalHandle:{alignSelf:'center',width:42,height:5,borderRadius:5,backgroundColor:'#cbd5e1',marginBottom:8},
    modalScroll:{paddingBottom:Platform.OS === 'ios' ? 34 : 20},
    choice:{padding:12,borderRadius:12,borderWidth:1,borderColor:theme.colors.border.subtle,backgroundColor:'#fff'},
    choiceActive:{borderColor:theme.colors.primary[600],backgroundColor:theme.colors.primary[50]},
    targetRow:{flexDirection:'row',gap:7},
    targetChoice:{flex:1,minHeight:58,padding:8,borderRadius:12,borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',justifyContent:'center',gap:5},
    recipientHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    recipientList:{maxHeight:150,gap:1,borderWidth:1,borderColor:theme.colors.border.subtle,borderRadius:10,overflow:'hidden'},
    recipientRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle},
    check:{width:22,height:22,borderRadius:6,borderWidth:1.5,borderColor:theme.colors.border.DEFAULT,alignItems:'center',justifyContent:'center'},
    checkActive:{backgroundColor:theme.colors.primary[700],borderColor:theme.colors.primary[700]},
    pickerList:{gap:7},
    institutionNote:{padding:12,borderRadius:12,backgroundColor:theme.colors.primary[50],flexDirection:'row',gap:9,alignItems:'center'},
    error:{margin:20,padding:14,backgroundColor:'#fff',borderRadius:14,gap:10},
});
