import { supabase } from '../libs/supabase';

function first(value) {
    return Array.isArray(value) ? value[0] : value;
}

function studentName(student) {
    return [student?.first_names, student?.last_names].filter(Boolean).join(' ') || 'Alumno';
}

export async function getAssistantGroups({ institutionId, membershipId }) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    if (!institutionId || !membershipId) throw new Error('No pudimos identificar tu institución y asignación.');

    const { data: assignments, error: assignmentsError } = await supabase
        .from('classroom_staff')
        .select('id,classroom_id,assignment_role,classrooms(id,level,grade_label,section_name,academic_year_id)')
        .eq('institution_id', institutionId)
        .eq('membership_id', membershipId)
        .eq('assignment_role', 'ASSISTANT')
        .eq('status', 'ACTIVE');

    if (assignmentsError) throw new Error('No se pudieron cargar tus grupos asignados.');
    if (!assignments?.length) return [];

    const classrooms = assignments
        .map((assignment) => first(assignment.classrooms))
        .filter(Boolean);
    const classroomIds = [...new Set(classrooms.map((classroom) => classroom.id))];
    if (!classroomIds.length) return [];

    const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('id,student_id,classroom_id,academic_year_id,students(id,first_names,last_names,student_code,status)')
        .eq('institution_id', institutionId)
        .in('classroom_id', classroomIds)
        .eq('status', 'ACTIVE');

    if (enrollmentsError) throw new Error('No se pudo cargar la lista de alumnos de tus grupos.');

    const studentsByClassroom = new Map(classroomIds.map((id) => [id, []]));
    (enrollments || []).forEach((enrollment) => {
        const student = first(enrollment.students);
        if (!student || student.status !== 'ACTIVE') return;
        studentsByClassroom.get(enrollment.classroom_id)?.push({
            id: student.id || enrollment.student_id,
            enrollmentId: enrollment.id,
            classroomId: enrollment.classroom_id,
            academicYearId: enrollment.academic_year_id,
            name: studentName(student),
            code: student.student_code || '',
        });
    });

    return classrooms.map((classroom) => {
        const students = (studentsByClassroom.get(classroom.id) || [])
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        return {
            id: classroom.id,
            classroomId: classroom.id,
            academicYearId: classroom.academic_year_id,
            level: classroom.level || '',
            gradeLabel: classroom.grade_label || '',
            sectionName: classroom.section_name || '',
            label: [classroom.grade_label, classroom.section_name].filter(Boolean).join(' ') || 'Aula asignada',
            students,
            studentCount: students.length,
        };
    }).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export async function getAssistantReports({ institutionId, membershipId }) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    if (!institutionId || !membershipId) throw new Error('No pudimos identificar tu institución y cuenta.');

    const { data, error } = await supabase
        .from('student_updates')
        .select('id,title,body,priority,created_at,student_id,classroom_id,students(first_names,last_names,student_code),classrooms(grade_label,section_name)')
        .eq('institution_id', institutionId)
        .eq('author_membership_id', membershipId)
        .eq('update_type', 'REPORT')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) throw new Error('No se pudieron consultar tus reportes.');
    return (data || []).map((item) => {
        const student = first(item.students);
        const classroom = first(item.classrooms);
        return {
            ...item,
            studentName: student ? studentName(student) : '',
            studentCode: student?.student_code || '',
            classroomName: [classroom?.grade_label, classroom?.section_name].filter(Boolean).join(' '),
        };
    });
}

export async function createAssistantReport({
    institutionId,
    membershipId,
    classroomId,
    studentId,
    title,
    body,
    priority = 'NORMAL',
}) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    if (!institutionId || !membershipId || !classroomId) throw new Error('Selecciona un grupo asignado.');
    if (cleanTitle.length < 3 || cleanTitle.length > 120) throw new Error('El título debe tener entre 3 y 120 caracteres.');
    if (!cleanBody || cleanBody.length > 3000) throw new Error('El detalle debe tener entre 1 y 3000 caracteres.');
    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) throw new Error('Selecciona una prioridad válida.');

    const { data, error } = await supabase
        .from('student_updates')
        .insert({
            institution_id: institutionId,
            author_membership_id: membershipId,
            classroom_id: classroomId,
            student_id: studentId || null,
            update_type: 'REPORT',
            title: cleanTitle,
            body: cleanBody,
            priority,
        })
        .select('id,title,body,priority,created_at,student_id,classroom_id')
        .single();

    if (error) {
        if (error.code === '42501') throw new Error('No tienes permiso para registrar reportes en este grupo. Verifica tu asignación.');
        throw new Error('No se pudo guardar el reporte. Inténtalo nuevamente.');
    }
    return data;
}
