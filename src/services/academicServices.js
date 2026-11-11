import { supabase } from '../libs/supabase';

function first(value) {
    return Array.isArray(value) ? value[0] : value;
}

function displayStudent(row) {
    const student = first(row.students);
    return {
        id: row.student_id || student?.id,
        enrollmentId: row.id,
        name: [student?.first_names, student?.last_names].filter(Boolean).join(' ') || 'Alumno',
        firstNames: student?.first_names || '',
        lastNames: student?.last_names || '',
        code: student?.student_code || '',
        status: student?.status || '',
    };
}

export async function getScheduleDetail(scheduleId, institutionId, membershipId) {
    if (!supabase || !scheduleId || !institutionId) return null;
    const { data, error } = await supabase.from('schedules')
        .select('id,weekday,start_time,end_time,classroom_label,course_assignment_id,course_assignments(id,academic_year_id,classroom_id,subjects(name),classrooms(id,grade_label,section_name))')
        .eq('id', scheduleId).eq('institution_id', institutionId).maybeSingle();
    if (error || !data) return getModernScheduleDetail(scheduleId, institutionId);

    const assignment = first(data.course_assignments);
    const classroom = first(assignment?.classrooms);
    const subject = first(assignment?.subjects);
    if (!assignment || !classroom) return null;

    const rosterResult = await supabase.from('enrollments')
        .select('id,student_id,students(id,first_names,last_names,student_code,status)')
        .eq('institution_id', institutionId).eq('academic_year_id', assignment.academic_year_id)
        .eq('classroom_id', classroom.id).eq('status', 'ACTIVE');
    const students = rosterResult.error ? [] : (rosterResult.data || [])
        .filter((row) => first(row.students)?.status === 'ACTIVE')
        .map(displayStudent).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const { data: tutorAssignment } = membershipId
        ? await supabase.from('classroom_staff').select('id')
            .eq('institution_id', institutionId).eq('classroom_id', classroom.id)
            .eq('membership_id', membershipId).eq('assignment_role', 'TUTOR').eq('status', 'ACTIVE').maybeSingle()
        : { data: null };

    return {
        ...data,
        schema: 'legacy',
        subject: subject?.name || 'Clase',
        section: `${classroom.grade_label} ${classroom.section_name}`,
        classroomId: classroom.id,
        academicYearId: assignment.academic_year_id,
        courseAssignmentId: assignment.id,
        students,
        isTutor: Boolean(tutorAssignment),
        rosterError: rosterResult.error?.message || '',
    };
}

async function getModernScheduleDetail(scheduleId, institutionId) {
    const { data: schedule, error } = await supabase.from('schedules')
        .select('id,weekday,start_time,end_time,classroom,section_id,course_offering_id,academic_year_id,course_offerings(id,name,subjects(name),sections(id,name,grade_levels(name)))')
        .eq('id', scheduleId).eq('institution_id', institutionId).maybeSingle();
    if (error || !schedule) return null;
    const offering = first(schedule.course_offerings);
    const section = first(offering?.sections);
    const subject = first(offering?.subjects);
    if (!section) return null;

    const { data: enrollments } = await supabase.from('enrollments')
        .select('id,student_id,students(id,student_code,status,people(first_names,last_names))')
        .eq('institution_id', institutionId).eq('academic_year_id', schedule.academic_year_id)
        .eq('section_id', section.id).eq('status', 'ACTIVE');
    const students = (enrollments || []).map((row) => {
        const student = first(row.students);
        const person = first(student?.people);
        return { id: row.student_id, enrollmentId: row.id, name: [person?.first_names, person?.last_names].filter(Boolean).join(' ') || 'Alumno', code: student?.student_code || '' };
    }).filter((student) => student.id).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const grade = first(section.grade_levels);
    return {
        ...schedule,
        schema: 'modern',
        subject: subject?.name || offering?.name || 'Clase',
        section: [grade?.name, section.name].filter(Boolean).join(' '),
        classroom_label: schedule.classroom || '',
        classroomId: section.id,
        academicYearId: schedule.academic_year_id,
        courseAssignmentId: offering?.id || null,
        students,
    };
}


export async function getStudentDetail(studentId, institutionId, classroomId) {
    if (!supabase || !studentId || !institutionId || !classroomId) return null;
    const { data: enrollment, error: enrollmentError } = await supabase.from('enrollments')
        .select('id,academic_year_id,classroom_id,enrolled_at,status,classrooms(grade_label,section_name),academic_years(name)')
        .eq('institution_id', institutionId).eq('student_id', studentId)
        .eq('classroom_id', classroomId).eq('status', 'ACTIVE').maybeSingle();
    if (enrollmentError || !enrollment) return null;

    const { data: student, error: studentError } = await supabase.from('students')
        .select('id,institution_id,first_names,last_names,document_type,document_number,birth_date,phone,email,student_code,admission_date,status,membership_id')
        .eq('institution_id', institutionId).eq('id', studentId).maybeSingle();
    if (studentError || !student) return null;

    const [updatesResult, attendanceResult] = await Promise.all([
        supabase.from('student_updates')
            .select('id,update_type,title,body,priority,created_at')
            .eq('institution_id', institutionId).eq('student_id', studentId)
            .order('created_at', { ascending: false }).limit(30),
        supabase.from('attendance_events')
            .select('id,event_type,occurred_at,notes')
            .eq('institution_id', institutionId).eq('student_id', studentId)
            .order('occurred_at', { ascending: false }).limit(30),
    ]);
    const classroom = first(enrollment.classrooms);
    const academicYear = first(enrollment.academic_years);
    return {
        ...student,
        academic_year_id: enrollment.academic_year_id,
        fullName: [student.first_names, student.last_names].filter(Boolean).join(' '),
        classroomName: [classroom?.grade_label, classroom?.section_name].filter(Boolean).join(' '),
        academicYearName: academicYear?.name || '',
        enrolledAt: enrollment.enrolled_at,
        guardians: null,
        updates: updatesResult.data || [],
        attendance: attendanceResult.data || [],
        historyError: updatesResult.error?.message || attendanceResult.error?.message || '',
    };
}

export async function getTeachingGroups({ institutionId, membershipId }) {
    if (!supabase || !institutionId || !membershipId) return [];
    const { data: assignments, error } = await supabase.from('course_assignments')
        .select('id,academic_year_id,classroom_id,subjects(name),classrooms(id,grade_label,section_name,academic_year_id)')
        .eq('institution_id', institutionId).eq('teacher_membership_id', membershipId).eq('status', 'ACTIVE');
    if (error) return [];

    const groups = (assignments || []).map((assignment) => {
        const classroom = first(assignment.classrooms);
        const subject = first(assignment.subjects);
        if (!classroom) return null;
        return {
            id: assignment.id,
            courseAssignmentId: assignment.id,
            academicYearId: assignment.academic_year_id,
            classroomId: assignment.classroom_id,
            label: `${classroom.grade_label} ${classroom.section_name} · ${subject?.name || 'Curso'}`,
        };
    }).filter(Boolean);

    const { data: tutorRows } = await supabase.from('classroom_staff')
        .select('classroom_id,classrooms(id,grade_label,section_name,academic_year_id)')
        .eq('institution_id', institutionId).eq('membership_id', membershipId)
        .eq('assignment_role', 'TUTOR').eq('status', 'ACTIVE');
    (tutorRows || []).forEach((row) => {
        const classroom = first(row.classrooms);
        if (!classroom) return;
        const id = `tutor-${classroom.id}`;
        if (!groups.some((group) => group.classroomId === classroom.id)) {
            groups.push({
                id,
                courseAssignmentId: null,
                academicYearId: classroom.academic_year_id,
                classroomId: classroom.id,
                label: `${classroom.grade_label} ${classroom.section_name} · Tutoría`,
            });
        }
    });
    return groups;
}

export async function getAssessments(institutionId, membershipId) {
    const groups = await getTeachingGroups({ institutionId, membershipId });
    const classroomIds = [...new Set(groups.map((group) => group.classroomId))];
    if (!supabase || !classroomIds.length) return { groups, assessments: [], error: '' };

    const { data, error } = await supabase.from('classroom_assessments')
        .select('id,institution_id,academic_year_id,classroom_id,course_assignment_id,title,description,assessment_date,maximum_score,status,classrooms(grade_label,section_name)')
        .eq('institution_id', institutionId).in('classroom_id', classroomIds)
        .neq('status', 'CANCELLED').order('assessment_date');
    if (error) return { groups, assessments: [], error: 'Aplica la migración de evaluaciones para habilitar exámenes y notas.' };

    const assessments = data || [];
    const assessmentIds = assessments.map((item) => item.id);
    const { data: grades } = assessmentIds.length
        ? await supabase.from('classroom_assessment_grades').select('assessment_id,student_id,score').in('assessment_id', assessmentIds)
        : { data: [] };
    const counts = new Map();
    (grades || []).forEach((grade) => counts.set(grade.assessment_id, (counts.get(grade.assessment_id) || 0) + 1));
    return {
        groups,
        assessments: assessments.map((item) => ({
            ...item,
            classroom: first(item.classrooms),
            gradedCount: counts.get(item.id) || 0,
        })),
        error: '',
    };
}

export async function createAssessment({ institutionId, membershipId, group, title, description, date, maximumScore }) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.from('classroom_assessments').insert({
        institution_id: institutionId,
        academic_year_id: group.academicYearId,
        classroom_id: group.classroomId,
        course_assignment_id: group.courseAssignmentId,
        title: title.trim(),
        description: description.trim() || null,
        assessment_date: date,
        maximum_score: Number(maximumScore),
        created_by_membership_id: membershipId,
    }).select('id').single();
    if (error) throw new Error('No se pudo guardar el examen. Verifica el aula y la fecha.');
    return data;
}

export async function getAssessmentDetail(assessmentId, institutionId) {
    if (!supabase) return null;
    const { data: assessment, error } = await supabase.from('classroom_assessments')
        .select('id,institution_id,academic_year_id,classroom_id,course_assignment_id,title,description,assessment_date,maximum_score,status,classrooms(grade_label,section_name)')
        .eq('id', assessmentId).eq('institution_id', institutionId).maybeSingle();
    if (error || !assessment) return null;

    const { data: enrollments, error: rosterError } = await supabase.from('enrollments')
        .select('id,student_id,students(id,first_names,last_names,student_code,status)')
        .eq('institution_id', institutionId).eq('academic_year_id', assessment.academic_year_id)
        .eq('classroom_id', assessment.classroom_id).eq('status', 'ACTIVE');
    const students = rosterError ? [] : (enrollments || []).filter((row) => first(row.students)?.status === 'ACTIVE').map(displayStudent);
    const { data: grades } = await supabase.from('classroom_assessment_grades')
        .select('student_id,score,feedback').eq('institution_id', institutionId).eq('assessment_id', assessmentId);
    const gradesByStudent = new Map((grades || []).map((grade) => [grade.student_id, grade]));
    return {
        ...assessment,
        classroom: first(assessment.classrooms),
        students: students.map((student) => ({ ...student, ...(gradesByStudent.get(student.id) || {}) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    };
}

export async function saveAssessmentGrades({ assessment, membershipId, rows }) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const updates = rows.filter((row) => row.score !== '' && row.score !== null && row.score !== undefined).map((row) => {
        const score = Number(row.score);
        if (!Number.isFinite(score) || score < 0 || score > Number(assessment.maximum_score)) {
            throw new Error(`La nota debe estar entre 0 y ${assessment.maximum_score}.`);
        }
        return {
            institution_id: assessment.institution_id,
            assessment_id: assessment.id,
            student_id: row.id,
            score,
            feedback: row.feedback || null,
            graded_by_membership_id: membershipId,
            graded_at: new Date().toISOString(),
        };
    });
    if (!updates.length) throw new Error('Ingresa al menos una nota para guardar.');
    const { error } = await supabase.from('classroom_assessment_grades')
        .upsert(updates, { onConflict: 'assessment_id,student_id' });
    if (error) throw new Error('No se pudieron guardar las notas. Verifica los permisos del curso.');
    return updates.length;
}
