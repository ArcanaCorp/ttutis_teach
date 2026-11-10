import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import Screen from '../../../components/ui/Screen';
import TextApp from '../../../components/ui/TextApp';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { getAssessmentDetail, saveAssessmentGrades } from '../../../services/academicServices';
import { theme } from '../../../constants/theme';

export default function AssessmentDetail() {
    const { id } = useLocalSearchParams();
    const { staff } = useAuth();
    const [assessment, setAssessment] = useState(null);
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        getAssessmentDetail(String(id || ''), staff?.institutionId).then((data) => {
            if (!active || !data) return;
            setAssessment(data);
            setScores(Object.fromEntries((data.students || []).map((student) => [student.id, student.score === undefined ? '' : String(student.score)])));
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id, staff?.institutionId]);

    async function save() {
        setSaving(true);
        try {
            const count = await saveAssessmentGrades({
                assessment,
                membershipId: staff?.membershipId,
                rows: assessment.students.map((student) => ({ id: student.id, score: scores[student.id] })),
            });
            Alert.alert('Notas guardadas', `Se guardaron ${count} notas.`);
        } catch (error) {
            Alert.alert('No se pudieron guardar', error.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Screen>
            <View style={styles.header}>
                <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver"><ArrowLeft size={20} color={theme.colors.text.primary} /></Pressable>
                <View style={{ flex: 1, gap: 3 }}><TextApp size="xl" variant="bold">Notas del examen</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Registra el puntaje final por alumno</TextApp></View>
            </View>
            {loading ? <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 28 }} /> : !assessment ? <View style={styles.empty}><TextApp size="sm" color={theme.colors.text.secondary}>No se encontró esta evaluación o aún no está habilitada en la base de datos.</TextApp></View> : (
                <View style={styles.content}>
                    <View style={styles.summary}><TextApp size="lg" variant="semibold">{assessment.title}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{assessment.classroom?.grade_label} {assessment.classroom?.section_name} · {assessment.assessment_date}</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>Nota máxima: {assessment.maximum_score}</TextApp></View>
                    {assessment.students.map((student) => (
                        <View key={student.id} style={styles.studentRow}>
                            <View style={{ flex: 1, gap: 3 }}><TextApp size="sm" variant="medium">{student.name}</TextApp><TextApp size="xs" color={theme.colors.text.tertiary}>{student.code || 'Sin código'}</TextApp></View>
                            <View style={styles.score}><Input value={scores[student.id] ?? ''} onChangeText={(value) => setScores((current) => ({ ...current, [student.id]: value }))} keyboardType="decimal-pad" placeholder="—" accessibilityLabel={`Nota de ${student.name}`} /></View>
                        </View>
                    ))}
                    <Button fullWidth icon={Save} loading={saving} onPress={save}>Guardar notas</Button>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
    back: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, gap: 10 },
    summary: { backgroundColor: theme.colors.primary[100], borderRadius: 18, padding: 16, gap: 4 },
    studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle },
    score: { width: 92 },
    empty: { marginHorizontal: 20, marginTop: 20, padding: 20, backgroundColor: '#fff', borderRadius: 16 },
});
