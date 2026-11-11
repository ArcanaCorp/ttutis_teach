import { supabase } from '../libs/supabase';

async function invokeAssistant(action, payload, fallback) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action, ...payload },
    });
    if (error) {
        try {
            const response = error.context;
            const body = response?.json ? await response.json() : null;
            if (body?.error) throw new Error(body.error);
        } catch (cause) {
            if (cause instanceof Error && cause.message !== 'Failed to fetch') throw cause;
        }
        throw new Error(fallback);
    }
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function getAssistantStudents({ institutionId, membershipId }) {
    if (!institutionId || !membershipId) throw new Error('No pudimos identificar tu institución y cuenta.');
    const result = await invokeAssistant('assistant_list_students', { membershipId }, 'No se pudo cargar la lista institucional de alumnos.');
    return {
        students: result?.students || [],
        classrooms: result?.classrooms || [],
    };
}

export async function getAssistantGroups({ institutionId, membershipId }) {
    const { students, classrooms } = await getAssistantStudents({ institutionId, membershipId });
    return classrooms.map((classroom) => {
        const members = students.filter((student) => student.classroom_id === classroom.id).map((student) => ({
            id: student.id,
            enrollmentId: student.enrollment_id,
            classroomId: student.classroom_id,
            academicYearId: student.academic_year_id,
            name: student.full_name,
            code: student.student_code || '',
        }));
        return {
            id: classroom.id,
            classroomId: classroom.id,
            level: classroom.level || '',
            gradeLabel: classroom.grade_label || '',
            sectionName: classroom.section_name || '',
            label: classroom.label || 'Salón',
            students: members,
            studentCount: members.length,
        };
    }).filter((classroom) => classroom.studentCount > 0);
}

export async function getAssistantReports({ institutionId, membershipId }) {
    if (!institutionId || !membershipId) throw new Error('No pudimos identificar tu institución y cuenta.');
    const result = await invokeAssistant('assistant_list_reports', { membershipId }, 'No se pudieron consultar tus reportes y comunicaciones.');
    return (result?.data || []).map((item) => ({
        ...item,
        studentName: [item.students?.first_names, item.students?.last_names].filter(Boolean).join(' '),
        studentCode: item.students?.student_code || '',
        classroomName: [item.classrooms?.grade_label, item.classrooms?.section_name].filter(Boolean).join(' '),
    }));
}

export async function createAssistantReport({
    institutionId, membershipId, title, body, priority = 'NORMAL',
    updateType = 'REPORT', targetType = 'STUDENTS', studentIds = [], classroomId = null,
}) {
    if (!institutionId || !membershipId) throw new Error('No pudimos identificar tu institución y cuenta.');
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    if (cleanTitle.length < 3 || cleanTitle.length > 120) throw new Error('El título debe tener entre 3 y 120 caracteres.');
    if (!cleanBody || cleanBody.length > 3000) throw new Error('El detalle debe tener entre 1 y 3000 caracteres.');
    const result = await invokeAssistant('assistant_create_communication', {
        membershipId, title: cleanTitle, body: cleanBody, priority, updateType, targetType, studentIds, classroomId,
    }, 'No se pudo guardar la comunicación.');
    return result;
}
