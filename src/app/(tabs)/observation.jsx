import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BellRing, ClipboardPenLine, GraduationCap } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { createClassroomCitation, createObservation } from '../../services/teacherTools';
import { theme } from '../../constants/theme';

export default function Observation() {
    const params = useLocalSearchParams();
    const contexts = useMemo(() => {
        try { return JSON.parse(String(params.contexts || '[]')); } catch { return []; }
    }, [params.contexts]);
    const [selected, setSelected] = useState(contexts[0] || null);
    const [mode, setMode] = useState('observation');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);

    const isCitation = mode === 'citation';
    const canCite = selected?.isTutor;

    async function submit() {
        if (!selected || !title.trim() || !body.trim()) {
            Alert.alert('Completa los datos', 'Elige el aula e ingresa título y detalle.');
            return;
        }
        setSaving(true);
        try {
            if (isCitation) {
                await createClassroomCitation({ classroomId: selected.classroomId, academicYearId: selected.academicYearId, title, body });
                Alert.alert('Citación enviada', `Se envió a ${selected.classroomName}.`);
            } else {
                await createObservation({ studentId: String(params.studentId), classroomId: selected.classroomId, title, body });
                Alert.alert('Observación guardada', `Se registró en el perfil de ${String(params.studentName || 'el alumno')}.`);
            }
            router.replace('/(tabs)/qr');
        } catch (error) {
            Alert.alert('No se pudo guardar', error.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Screen>
            <View style={styles.header}>
                <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver"><ArrowLeft size={20} color={theme.colors.text.primary} /></Pressable>
                <View><TextApp size="xl" variant="bold">{isCitation ? 'Citación al aula' : 'Nueva observación'}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Alumno identificado por QR</TextApp></View>
            </View>

            <View style={styles.studentCard}>
                <View style={styles.studentIcon}><GraduationCap size={22} color={theme.colors.primary[800]} /></View>
                <View style={{ flex: 1, gap: 3 }}><TextApp size="md" variant="semibold">{String(params.studentName || 'Alumno')}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{params.studentCode ? `Código ${String(params.studentCode)}` : 'Alumno de tu institución'}</TextApp></View>
            </View>

            <View style={styles.content}>
                <TextApp size="sm" variant="semibold">Aula relacionada</TextApp>
                <View style={styles.contextList}>{contexts.map((item) => (
                    <Pressable key={item.classroomId} onPress={() => setSelected(item)} style={[styles.contextChip, selected?.classroomId === item.classroomId && styles.contextSelected]}>
                        <TextApp size="xs" variant="medium" color={selected?.classroomId === item.classroomId ? theme.colors.primary[950] : theme.colors.text.secondary}>{item.classroomName}{item.isTutor ? ' · Tutor' : ''}</TextApp>
                    </Pressable>
                ))}</View>

                {canCite && (
                    <View style={styles.modeRow}>
                        <Pressable onPress={() => setMode('observation')} style={[styles.modeButton, !isCitation && styles.modeSelected]}><ClipboardPenLine size={16} color={theme.colors.primary[800]} /><TextApp size="xs" variant="medium">Observación</TextApp></Pressable>
                        <Pressable onPress={() => setMode('citation')} style={[styles.modeButton, isCitation && styles.modeSelected]}><BellRing size={16} color={theme.colors.primary[800]} /><TextApp size="xs" variant="medium">Citación al salón</TextApp></Pressable>
                    </View>
                )}

                {isCitation && <View style={styles.notice}><TextApp size="xs" color={theme.colors.primary[950]}>La citación se enviará a todos los alumnos del aula seleccionada.</TextApp></View>}
                <Input label="Título" placeholder={isCitation ? 'Citación a reunión' : 'Participación, convivencia…'} value={title} onChangeText={setTitle} maxLength={120} />
                <Input label={isCitation ? 'Mensaje para el aula' : 'Detalle de la observación'} placeholder={isCitation ? 'Escribe el motivo, fecha y detalles para las familias.' : 'Describe brevemente lo ocurrido.'} value={body} onChangeText={setBody} multiline numberOfLines={5} minHeight={120} maxLength={3000} showCharacterCount />
                <Button fullWidth loading={saving} disabled={!contexts.length} onPress={submit}>{isCitation ? 'Enviar citación al aula' : 'Guardar observación'}</Button>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18 },
    back: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    studentCard: { marginHorizontal: 20, padding: 14, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 12 },
    studentIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, gap: 13 },
    contextList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    contextChip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle },
    contextSelected: { backgroundColor: theme.colors.primary[100], borderColor: theme.colors.primary[400] },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeButton: { flex: 1, minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.border.subtle, backgroundColor: '#fff' },
    modeSelected: { backgroundColor: theme.colors.primary[100], borderColor: theme.colors.primary[400] },
    notice: { padding: 11, borderRadius: 12, backgroundColor: theme.colors.primary[100] },
});
