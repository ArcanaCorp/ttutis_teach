/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function parseKeyMap(value) {
    try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function json(data, status = 200) {
    return Response.json(data, { status, headers: corsHeaders });
}

function errorResponse(message, status = 400) {
    return json({ error: message }, status);
}

function normalizeQr(value) {
    if (typeof value !== 'string') return {};
    const raw = value.trim();
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return {
                studentId: parsed.student_id || parsed.studentId || parsed.id || '',
                studentCode: parsed.student_code || parsed.studentCode || parsed.code || '',
                token: parsed.token || parsed.qr_token || parsed.qrToken || '',
            };
        }
    } catch { /* Plain QR payload. */ }

    try {
        const url = new URL(raw);
        const studentId = url.searchParams.get('student_id') || url.searchParams.get('studentId') || url.searchParams.get('id') || '';
        const studentCode = url.searchParams.get('student_code') || url.searchParams.get('studentCode') || url.searchParams.get('code') || '';
        const token = url.searchParams.get('token') || url.searchParams.get('qr_token') || '';
        if (studentId || studentCode || token) return { studentId, studentCode, token };
        return { token: url.pathname.split('/').filter(Boolean).pop() || '' };
    } catch { /* Plain QR payload. */ }

    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) return { studentId: raw };
    // Legacy attendance QR values are stored directly as 32-character MD5 hex strings.
    // Detect them before the generic alphanumeric student-code pattern.
    if (/^[0-9a-f]{32}$/i.test(raw)) return { token: raw };
    if (/^[A-Z0-9-]{4,32}$/i.test(raw)) return { studentCode: raw };
    return { token: raw };
}

async function digestHex(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function findStudent(admin, institutionId, qrPayload) {
    const parsed = normalizeQr(qrPayload);
    const fields = 'id,institution_id,first_names,last_names,student_code,status';

    if (parsed.studentId) {
        const { data } = await admin.from('students').select(fields).eq('institution_id', institutionId).eq('id', parsed.studentId).eq('status', 'ACTIVE').maybeSingle();
        if (data) return data;
    }
    if (parsed.studentCode) {
        const { data } = await admin.from('students').select(fields).eq('institution_id', institutionId).ilike('student_code', parsed.studentCode).eq('status', 'ACTIVE').maybeSingle();
        if (data) return data;
    }
    if (!parsed.token) return null;

    const hash = await digestHex(parsed.token);
    const { data: legacyStudent } = await admin.from('students').select(fields)
        .eq('institution_id', institutionId).eq('attendance_qr_hash', hash).eq('status', 'ACTIVE').maybeSingle();
    if (legacyStudent) return legacyStudent;

    const { data: rawHashStudent } = await admin.from('students').select(fields)
        .eq('institution_id', institutionId).eq('attendance_qr_hash', parsed.token).eq('status', 'ACTIVE').maybeSingle();
    if (rawHashStudent) return rawHashStudent;

    const { data: credentials } = await admin.from('qr_credentials').select('student_id')
        .eq('institution_id', institutionId).eq('token_hash', `\\x${hash}`).eq('status', 'ACTIVE').limit(2);
    if (credentials?.length === 1) {
        const { data } = await admin.from('students').select(fields).eq('institution_id', institutionId)
            .eq('id', credentials[0].student_id).eq('status', 'ACTIVE').maybeSingle();
        if (data) return data;
    }
    return null;
}

async function classroomContexts(admin, membership, studentId) {
    const { data: enrollments, error: enrollmentError } = await admin.from('enrollments')
        .select('id,academic_year_id,classroom_id').eq('institution_id', membership.institution_id)
        .eq('student_id', studentId).eq('status', 'ACTIVE');
    if (enrollmentError || !enrollments?.length) return [];

    const { data: assignments } = await admin.from('course_assignments').select('classroom_id')
        .eq('institution_id', membership.institution_id).eq('teacher_membership_id', membership.id).eq('status', 'ACTIVE');
    const { data: staffAssignments } = await admin.from('classroom_staff').select('classroom_id,assignment_role')
        .eq('institution_id', membership.institution_id).eq('membership_id', membership.id).eq('status', 'ACTIVE');
    const permitted = new Map();
    (assignments || []).forEach((item) => permitted.set(item.classroom_id, false));
    (staffAssignments || []).forEach((item) => {
        permitted.set(item.classroom_id, item.assignment_role === 'TUTOR');
    });

    const allowedEnrollments = enrollments.filter((item) => permitted.has(item.classroom_id));
    if (!allowedEnrollments.length) return [];
    const classroomIds = [...new Set(allowedEnrollments.map((item) => item.classroom_id))];
    const { data: classrooms } = await admin.from('classrooms').select('id,grade_label,section_name,academic_year_id')
        .eq('institution_id', membership.institution_id).in('id', classroomIds);
    return allowedEnrollments.map((enrollment) => {
        const classroom = classrooms?.find((item) => item.id === enrollment.classroom_id);
        return {
            enrollmentId: enrollment.id,
            classroomId: enrollment.classroom_id,
            academicYearId: enrollment.academic_year_id,
            classroomName: classroom ? `${classroom.grade_label} ${classroom.section_name}` : 'Aula',
            isTutor: permitted.get(enrollment.classroom_id) === true,
        };
    });
}

async function getCaller(req, admin, publicKey) {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return null;
    const scopedClient = createClient(Deno.env.get('SUPABASE_URL'), publicKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await scopedClient.auth.getUser();
    if (error || !data?.user) return null;
    const { data: memberships } = await admin.from('memberships')
        .select('id,institution_id,role,status').eq('profile_id', data.user.id)
        .eq('status', 'ACTIVE').in('role', ['TEACHER', 'ASSISTANT']);
    return { user: data.user, memberships: memberships || [] };
}

async function handleResolveQr(admin, caller, payload) {
    const qrPayload = payload?.value;
    if (typeof qrPayload !== 'string' || !qrPayload.trim() || qrPayload.length > 4096) {
        return errorResponse('El código QR no es válido.');
    }

    for (const membership of caller.memberships) {
        const student = await findStudent(admin, membership.institution_id, qrPayload);
        if (!student) continue;
        const contexts = await classroomContexts(admin, membership, student.id);
        if (!contexts.length) continue;
        return json({
            student: {
                id: student.id,
                name: [student.first_names, student.last_names].filter(Boolean).join(' '),
                code: student.student_code,
                membershipId: membership.id,
                institutionId: membership.institution_id,
            },
            classrooms: contexts,
        });
    }
    return errorResponse('No encontramos un alumno activo de tus aulas con ese código.', 404);
}

async function handleCreateObservation(admin, caller, payload) {
    const { studentId, classroomId, title, body } = payload || {};
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    if (!studentId || !classroomId || cleanTitle.length < 3 || !cleanBody || cleanBody.length > 3000) {
        return errorResponse('Completa un título y el detalle de la observación.');
    }

    for (const membership of caller.memberships) {
        const contexts = await classroomContexts(admin, membership, studentId);
        const context = contexts.find((item) => item.classroomId === classroomId);
        if (!context) continue;
        const { data, error } = await admin.from('student_updates').insert({
            institution_id: membership.institution_id,
            author_membership_id: membership.id,
            student_id: studentId,
            update_type: 'BEHAVIOR',
            title: cleanTitle,
            body: cleanBody,
            priority: 'NORMAL',
        }).select('id,title,created_at').single();
        if (error) return errorResponse('No se pudo guardar la observación. Revisa que la actualización de comunicaciones esté aplicada.', 409);
        return json({ data }, 201);
    }
    return errorResponse('No tienes permiso para registrar observaciones en esta aula.', 403);
}

async function handleCreateCitation(admin, caller, payload) {
    const { classroomId, academicYearId, title, body } = payload || {};
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    if (!classroomId || !academicYearId || cleanTitle.length < 3 || !cleanBody || cleanBody.length > 3000) {
        return errorResponse('Completa el título y el mensaje de la citación.');
    }

    for (const membership of caller.memberships) {
        if (membership.role !== 'TEACHER') continue;
        const { data: tutorAssignment } = await admin.from('classroom_staff').select('id')
            .eq('institution_id', membership.institution_id).eq('classroom_id', classroomId)
            .eq('membership_id', membership.id).eq('assignment_role', 'TUTOR').eq('status', 'ACTIVE').maybeSingle();
        if (!tutorAssignment) continue;
        const { data: classroom } = await admin.from('classrooms').select('id,academic_year_id')
            .eq('id', classroomId).eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').maybeSingle();
        if (!classroom || classroom.academic_year_id !== academicYearId) continue;
        const { data, error } = await admin.from('student_updates').insert({
            institution_id: membership.institution_id,
            author_membership_id: membership.id,
            classroom_id: classroom.id,
            update_type: 'CITATION',
            title: cleanTitle,
            body: cleanBody,
            priority: 'NORMAL',
        }).select('id,title,created_at').single();
        if (error) return errorResponse('No se pudo enviar la citación al aula.', 409);
        return json({ data }, 201);
    }
    return errorResponse('Solo el tutor del aula puede enviar una citación grupal.', 403);
}

async function assignedMembership(admin, caller, classroomId) {
    for (const membership of caller.memberships) {
        if (membership.role !== 'TEACHER') continue;
        const { data: assignment } = await admin.from('course_assignments').select('id')
            .eq('institution_id', membership.institution_id).eq('classroom_id', classroomId)
            .eq('teacher_membership_id', membership.id).eq('status', 'ACTIVE').limit(1).maybeSingle();
        const { data: classroomStaff } = assignment ? { data: null } : await admin.from('classroom_staff').select('id')
            .eq('institution_id', membership.institution_id).eq('classroom_id', classroomId)
            .eq('membership_id', membership.id).eq('status', 'ACTIVE').limit(1).maybeSingle();
        if (assignment || classroomStaff) return membership;
    }
    return null;
}

async function handleClassAnnouncements(admin, caller, payload) {
    const classroomId = payload?.classroomId || payload?.sectionId;
    const { action } = payload || {};
    if (!classroomId) return errorResponse('El aula no es válida.');
    const membership = await assignedMembership(admin, caller, classroomId);
    if (!membership) return errorResponse('No tienes permiso para ver los anuncios de esta aula.', 403);
    if (action === 'list_announcements') {
        const { data, error } = await admin.from('student_updates')
            .select('id,title,body,priority,visible_from,created_at')
            .eq('institution_id', membership.institution_id).eq('classroom_id', classroomId)
            .eq('update_type', 'ANNOUNCEMENT')
            .order('created_at', { ascending: false }).limit(100);
        if (error) return errorResponse('No se pudieron cargar los anuncios del aula.', 409);
        return json({ data: data || [] });
    }
    const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    if (title.length < 3 || title.length > 120 || !body || body.length > 3000) {
        return errorResponse('Completa un título y un mensaje de hasta 3000 caracteres.');
    }
    const { data: classroom } = await admin.from('classrooms').select('id,academic_year_id')
        .eq('id', classroomId).eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').maybeSingle();
    if (!classroom) return errorResponse('No encontramos el aula activa.', 404);
    const { data, error } = await admin.from('student_updates').insert({
        institution_id: membership.institution_id,
        author_membership_id: membership.id,
        classroom_id: classroom.id,
        update_type: 'ANNOUNCEMENT',
        title,
        body,
        priority: 'NORMAL',
    }).select('id,title,body,priority,visible_from,created_at').single();
    if (error) return errorResponse('No se pudo publicar el anuncio.', 409);
    return json({ data }, 201);
}



async function assistantMembership(caller, payload) {
    const membershipId = typeof payload?.membershipId === 'string' ? payload.membershipId : '';
    return caller.memberships.find((item) => item.role === 'ASSISTANT' && item.id === membershipId) || null;
}

async function fetchAllRows(queryFactory, pageSize = 1000) {
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
        if (error) return { data: null, error };
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    return { data: rows, error: null };
}

async function handleAssistantStudents(admin, caller, payload) {
    const membership = await assistantMembership(caller, payload);
    if (!membership) return errorResponse('No tienes una sesión auxiliar activa para esta institución.', 403);

    // Paginate independently: large ID filters exceed PostgREST URL limits.
    const [{ data: students, error: studentsError }, { data: enrollments, error: enrollmentError }, { data: classrooms, error: classroomsError }] = await Promise.all([
        fetchAllRows(() => admin.from('students')
            .select('id,first_names,last_names,student_code,status')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').order('id')),
        fetchAllRows(() => admin.from('enrollments')
            .select('id,student_id,classroom_id,academic_year_id')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').order('id')),
        fetchAllRows(() => admin.from('classrooms')
            .select('id,academic_year_id,level,grade_label,section_name,status')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').order('id')),
    ]);
    if (studentsError) {
        console.error('Assistant students query failed.', studentsError.message);
        return errorResponse('No se pudieron consultar los alumnos activos de la institución.', 500);
    }
    if (enrollmentError) {
        console.error('Assistant enrollments query failed.', enrollmentError.message);
        return errorResponse('No se pudieron consultar las matrículas institucionales.', 500);
    }
    if (classroomsError) {
        console.error('Assistant classrooms query failed.', classroomsError.message);
        return errorResponse('No se pudieron consultar los salones institucionales.', 500);
    }

    const classroomMap = new Map((classrooms || []).map((item) => [item.id, item]));
    const enrollmentByStudent = new Map();
    for (const enrollment of enrollments || []) {
        if (classroomMap.has(enrollment.classroom_id) && !enrollmentByStudent.has(enrollment.student_id)) {
            enrollmentByStudent.set(enrollment.student_id, enrollment);
        }
    }
    const studentRows = (students || []).map((student) => {
        const enrollment = enrollmentByStudent.get(student.id);
        const classroom = enrollment ? classroomMap.get(enrollment.classroom_id) : null;
        return {
            id: student.id,
            first_names: student.first_names,
            last_names: student.last_names,
            full_name: [student.first_names, student.last_names].filter(Boolean).join(' '),
            student_code: student.student_code || '',
            enrollment_id: enrollment?.id || null,
            classroom_id: classroom?.id || null,
            classroom_name: classroom ? [classroom.grade_label, classroom.section_name].filter(Boolean).join(' ') : 'Sin salón asignado',
            level: classroom?.level || '',
            grade_label: classroom?.grade_label || '',
            section_name: classroom?.section_name || '',
            academic_year_id: enrollment?.academic_year_id || classroom?.academic_year_id || null,
        };
    });
    const classroomRows = (classrooms || []).map((item) => ({
        id: item.id, level: item.level, grade_label: item.grade_label, section_name: item.section_name,
        label: [item.grade_label, item.section_name].filter(Boolean).join(' '),
    })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return json({
        students: studentRows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
        classrooms: classroomRows,
    });
}

async function handleAssistantReports(admin, caller, payload) {
    const membership = await assistantMembership(caller, payload);
    if (!membership) return errorResponse('No tienes una sesión auxiliar activa para esta institución.', 403);
    const { data, error } = await admin.from('student_updates')
        .select('id,title,body,priority,created_at,visible_from,update_type,student_id,classroom_id,students(first_names,last_names,student_code),classrooms(grade_label,section_name)')
        .eq('institution_id', membership.institution_id).eq('author_membership_id', membership.id)
        .in('update_type', ['REPORT','BEHAVIOR','CITATION','ANNOUNCEMENT','RECOMMENDATION','NOTIFICATION'])
        .order('created_at', { ascending: false }).limit(300);
    if (error) return errorResponse('No se pudieron consultar tus reportes y comunicaciones.', 500);
    return json({ data: data || [] });
}

async function handleCreateAssistantCommunication(admin, caller, payload) {
    const membership = await assistantMembership(caller, payload);
    if (!membership) return errorResponse('No tienes una sesión auxiliar activa para esta institución.', 403);
    const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    const priority = payload?.priority || 'NORMAL';
    const updateType = payload?.updateType;
    const targetType = payload?.targetType;
    if (title.length < 3 || title.length > 120 || !body || body.length > 3000) return errorResponse('El título debe tener entre 3 y 120 caracteres y el detalle no puede superar 3000 caracteres.');
    if (!['LOW','NORMAL','HIGH','URGENT'].includes(priority)) return errorResponse('La prioridad seleccionada no es válida.');
    if (!['REPORT','BEHAVIOR','CITATION','ANNOUNCEMENT','RECOMMENDATION','NOTIFICATION'].includes(updateType)) return errorResponse('El tipo de comunicación no es válido.');
    if (!['STUDENTS','CLASSROOM','INSTITUTION'].includes(targetType)) return errorResponse('Selecciona destinatarios válidos.');

    let rows = [];
    if (targetType === 'STUDENTS') {
        const ids = [...new Set(Array.isArray(payload?.studentIds) ? payload.studentIds.filter((id) => typeof id === 'string') : [])];
        if (!ids.length || ids.length > 500) return errorResponse('Selecciona entre 1 y 500 alumnos.');
        const { data: students, error } = await admin.from('students').select('id')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').in('id', ids);
        if (error) return errorResponse('No se pudieron validar los alumnos seleccionados.', 500);
        if ((students || []).length !== ids.length) return errorResponse('Uno o más alumnos no pertenecen a tu institución o ya no están activos.', 403);
        const { data: enrollments, error: enrollmentError } = await admin.from('enrollments')
            .select('student_id,classroom_id').eq('institution_id', membership.institution_id)
            .eq('status', 'ACTIVE').in('student_id', ids);
        if (enrollmentError) return errorResponse('No se pudieron validar las matrículas de los alumnos.', 500);
        const activeClassrooms = new Set();
        const classroomIds = [...new Set((enrollments || []).map((item) => item.classroom_id))];
        if (classroomIds.length) {
            const { data: classrooms } = await admin.from('classrooms').select('id')
                .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').in('id', classroomIds);
            (classrooms || []).forEach((item) => activeClassrooms.add(item.id));
        }
        const classroomByStudent = new Map();
        (enrollments || []).forEach((item) => {
            if (activeClassrooms.has(item.classroom_id) && !classroomByStudent.has(item.student_id)) classroomByStudent.set(item.student_id, item.classroom_id);
        });
        rows = ids.map((id) => ({ student_id: id, classroom_id: classroomByStudent.get(id) || null }));
    } else if (targetType === 'CLASSROOM') {
        const classroomId = payload?.classroomId;
        if (typeof classroomId !== 'string') return errorResponse('Selecciona un salón válido.');
        const { data: classroom, error } = await admin.from('classrooms').select('id')
            .eq('id', classroomId).eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').maybeSingle();
        if (error || !classroom) return errorResponse('El salón no pertenece a tu institución o no está activo.', 403);
        const { data: enrollments, error: enrollmentError } = await admin.from('enrollments')
            .select('student_id').eq('institution_id', membership.institution_id)
            .eq('classroom_id', classroom.id).eq('status', 'ACTIVE');
        if (enrollmentError) return errorResponse('No se pudieron consultar los alumnos del salón.', 500);
        const studentIds = [...new Set((enrollments || []).map((item) => item.student_id))];
        if (!studentIds.length) return errorResponse('Este salón no tiene alumnos con matrícula activa.');
        const { data: activeStudents, error: studentsError } = await admin.from('students').select('id')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').in('id', studentIds);
        if (studentsError) return errorResponse('No se pudieron validar los alumnos del salón.', 500);
        rows = (activeStudents || []).map((item) => ({ student_id: item.id, classroom_id: classroom.id }));
    } else if (updateType === 'ANNOUNCEMENT') {
        rows = [{ student_id: null, classroom_id: null }];
    } else {
        const { data: students, error } = await admin.from('students').select('id')
            .eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').limit(5000);
        if (error) return errorResponse('No se pudo consultar a los alumnos de la institución.', 500);
        const ids = (students || []).map((item) => item.id);
        if (!ids.length) return errorResponse('No hay alumnos activos para registrar esta comunicación.');
        const { data: enrollments, error: enrollmentError } = await admin.from('enrollments')
            .select('student_id,classroom_id').eq('institution_id', membership.institution_id)
            .eq('status', 'ACTIVE').in('student_id', ids);
        if (enrollmentError) return errorResponse('No se pudieron consultar las matrículas institucionales.', 500);
        const classroomIds = [...new Set((enrollments || []).map((item) => item.classroom_id))];
        const { data: classrooms } = classroomIds.length
            ? await admin.from('classrooms').select('id').eq('institution_id', membership.institution_id).eq('status', 'ACTIVE').in('id', classroomIds)
            : { data: [] };
        const activeClassrooms = new Set((classrooms || []).map((item) => item.id));
        const classroomByStudent = new Map();
        (enrollments || []).forEach((item) => {
            if (activeClassrooms.has(item.classroom_id) && !classroomByStudent.has(item.student_id)) classroomByStudent.set(item.student_id, item.classroom_id);
        });
        rows = ids.map((id) => ({ student_id: id, classroom_id: classroomByStudent.get(id) || null }));
    }
    if (!rows.length) return errorResponse('No encontramos destinatarios activos para esta comunicación.');
    const insertRows = rows.map((target) => ({
        institution_id: membership.institution_id,
        author_membership_id: membership.id,
        student_id: target.student_id,
        classroom_id: target.classroom_id,
        update_type: updateType,
        title,
        body,
        priority,
    }));
    const { data, error } = await admin.from('student_updates').insert(insertRows)
        .select('id,title,update_type,priority,created_at,student_id,classroom_id');
    if (error) {
        console.error('Assistant communication insert failed.', error.message);
        return errorResponse('No se pudo guardar la comunicación. No se envió ninguna notificación push.', 409);
    }
    return json({ data: data || [], recipientCount: rows.length, targetType }, 201);
}

function localDateAndTime(timeZone, instant = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const date = `${values.year}-${values.month}-${values.day}`;
    const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
    const clock = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
    return { date, time: `${clock.hour}:${clock.minute}` };
}
function classifyAttendance(clock, schedule) {
    const p = schedule?.punctual, l = schedule?.late, a = schedule?.absence;
    if (!p?.start || !p?.end || !l?.start || !l?.end || !a?.from) return null;
    if (clock >= p.start && clock < p.end) return 'PUNCTUAL';
    if (clock >= l.start && clock < l.end) return 'LATE';
    if (clock >= a.from) return 'AFTER_WINDOW';
    return 'CLOSED';
}
async function handleAssistantAttendance(admin, caller, payload) {
    const requestStartedAt = performance.now();
    const requestId = crypto.randomUUID();
    const trace = (stage, extra = {}) => console.log('[ASSISTANT_ATTENDANCE]', JSON.stringify({ requestId, stage, elapsedMs: Math.round(performance.now() - requestStartedAt), timestamp: new Date().toISOString(), ...extra }));
    trace('started');
    const qrPayload = payload?.value;
    if (typeof qrPayload !== 'string' || !qrPayload.trim() || qrPayload.length > 4096) return errorResponse('El código QR no es válido.');
    const assistants = caller.memberships.filter((m) => m.role === 'ASSISTANT');
    if (!assistants.length) return errorResponse('Esta acción está disponible únicamente para auxiliares.', 403);
    for (const membership of assistants) {
        const findStartedAt = performance.now();
        const student = await findStudent(admin, membership.institution_id, qrPayload);
        trace('student_lookup', { durationMs: Math.round(performance.now() - findStartedAt), found: Boolean(student) });
        if (!student) continue;
        const enrollmentStartedAt = performance.now();
        const { data: enrollments, error: enrollmentError } = await admin.from('enrollments').select('id,classroom_id')
            .eq('institution_id', membership.institution_id).eq('student_id', student.id).eq('status', 'ACTIVE');
        if (enrollmentError) return errorResponse('No se pudo validar la matrícula del alumno.', 500);
        trace('enrollments_lookup', { durationMs: Math.round(performance.now() - enrollmentStartedAt), count: enrollments?.length || 0 });
        if (!enrollments?.length) return errorResponse('El alumno no tiene una matrícula activa.', 409);
        const classroomIds = [...new Set(enrollments.map((e) => e.classroom_id))];
        const classroomStartedAt = performance.now();
        const { data: classrooms, error: classroomError } = await admin.from('classrooms').select('id,level,status')
            .eq('institution_id', membership.institution_id).in('id', classroomIds).eq('status', 'ACTIVE');
        trace('classrooms_lookup', { durationMs: Math.round(performance.now() - classroomStartedAt), count: classrooms?.length || 0 });
        if (classroomError) return errorResponse('No se pudo validar el aula del alumno.', 500);
        const enrollment = enrollments.find((e) => classrooms?.some((c) => c.id === e.classroom_id));
        const classroom = classrooms?.find((c) => c.id === enrollment?.classroom_id);
        if (!enrollment || !classroom) return errorResponse('El alumno no tiene un aula activa.', 409);
        const institutionStartedAt = performance.now();
        const { data: institution, error: institutionError } = await admin.from('institutions')
            .select('timezone,attendance_settings').eq('id', membership.institution_id).eq('status', 'ACTIVE').maybeSingle();
        trace('institution_settings', { durationMs: Math.round(performance.now() - institutionStartedAt) });
        if (institutionError || !institution) return errorResponse('No se pudo consultar la configuración institucional.', 500);
        const schedule = institution.attendance_settings?.by_level?.[classroom.level] || institution.attendance_settings?.global;
        if (!schedule) return errorResponse(`La asistencia todavía no está configurada para el nivel ${classroom.level}.`, 409);
        const now = new Date();
        const { date, time } = localDateAndTime(institution.timezone || 'America/Lima', now);
        const status = classifyAttendance(time, schedule);
        if (status === 'AFTER_WINDOW') return errorResponse('La ventana de asistencia ya terminó. El escaneo QR no puede registrar ingresos fuera del horario habilitado.', 409);
        if (status === 'CLOSED') return errorResponse('La ventana de asistencia no está abierta en este momento.', 409);
        if (!status) return errorResponse('La configuración de horarios de este nivel está incompleta.', 409);
        const key = `assistant_qr_entry:${student.id}:${date}`;
        const fields = 'id,attendance_status,attendance_local_date,occurred_at,justification_status,justification_notes';
        const existingStartedAt = performance.now();
        const { data: existing, error: lookupError } = await admin.from('attendance_events').select(fields)
            .eq('institution_id', membership.institution_id).eq('idempotency_key', key).maybeSingle();
        trace('idempotency_lookup', { durationMs: Math.round(performance.now() - existingStartedAt), exists: Boolean(existing) });
        if (lookupError) return errorResponse('No se pudo comprobar si el alumno ya registró su asistencia.', 500);
        const studentData = { id: student.id, name: [student.first_names, student.last_names].filter(Boolean).join(' '), code: student.student_code };
        if (existing) { trace('completed', { result: 'already_recorded' }); return json({ alreadyRecorded: true, event: existing, student: studentData }); }
        const insertStartedAt = performance.now();
        const { data: event, error: insertError } = await admin.from('attendance_events').insert({
            institution_id: membership.institution_id, student_id: student.id, enrollment_id: enrollment.id,
            event_type: 'ENTRY', occurred_at: now.toISOString(), source: 'QR',
            recorded_by_membership_id: membership.id, idempotency_key: key,
            attendance_status: status, attendance_local_date: date,
            justification_status: status === 'ABSENCE' ? 'UNJUSTIFIED' : 'NOT_REQUIRED',
        }).select('id,attendance_status,attendance_local_date,occurred_at,justification_status').single();
        if (insertError?.code === '23505') {
            const { data: duplicate } = await admin.from('attendance_events').select(fields)
                .eq('institution_id', membership.institution_id).eq('idempotency_key', key).maybeSingle();
            if (duplicate) return json({ alreadyRecorded: true, event: duplicate, student: studentData });
        }
        trace('attendance_insert', { durationMs: Math.round(performance.now() - insertStartedAt), success: !insertError });
        if (insertError) { console.error('Assistant attendance insert failed.', insertError.message); return errorResponse('No se pudo registrar la asistencia.', 500); }
        trace('completed', { result: 'created' });
        return json({ alreadyRecorded: false, event, student: studentData }, 201);
    }
    return errorResponse('No encontramos un alumno activo de esta institución con ese código QR.', 404);
}
async function handleJustifyAssistantAbsence(admin, caller, payload) {
    const assistants = caller.memberships.filter((m) => m.role === 'ASSISTANT');
    if (!assistants.length) return errorResponse('Esta acción está disponible únicamente para auxiliares.', 403);
    const eventId = payload?.eventId;
    const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
    if (!eventId || reason.length < 4 || reason.length > 1000) return errorResponse('Escribe el motivo de la justificación (4 a 1000 caracteres).');
    for (const membership of assistants) {
        const { data, error } = await admin.from('attendance_events').update({
            justification_status: 'JUSTIFIED', justification_notes: reason,
            justified_at: new Date().toISOString(), justified_by_membership_id: membership.id,
        }).eq('id', eventId).eq('institution_id', membership.institution_id)
            .eq('attendance_status', 'ABSENCE').eq('justification_status', 'UNJUSTIFIED')
            .select('id,justification_status,justification_notes,justified_at').maybeSingle();
        if (error) return errorResponse('No se pudo guardar la justificación.', 500);
        if (data) return json({ data });
        const { data: event } = await admin.from('attendance_events').select('id,justification_status')
            .eq('id', eventId).eq('institution_id', membership.institution_id).maybeSingle();
        if (event?.justification_status === 'JUSTIFIED') return json({ data: event, alreadyJustified: true });
    }
    return errorResponse('No encontramos una falta pendiente de justificar para esta institución.', 404);
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return errorResponse('Método no permitido.', 405);

    const url = Deno.env.get('SUPABASE_URL');
    const publishableKeys = parseKeyMap(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
    const secretKeys = parseKeyMap(Deno.env.get('SUPABASE_SECRET_KEYS'));
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || publishableKeys.default || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || secretKeys.default || Deno.env.get('SUPABASE_SECRET_KEY');
    const suppliedKey = request.headers.get('apikey');
    const allowedKeys = new Set([
        ...Object.values(publishableKeys),
        Deno.env.get('SUPABASE_ANON_KEY'),
        Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    ].filter(Boolean));
    if (!url || !publicKey || !secretKey || !suppliedKey || !allowedKeys.has(suppliedKey)) {
        return errorResponse('El servicio para docentes no está configurado.', 503);
    }

    let payload;
    try { payload = await request.json(); } catch { return errorResponse('Solicitud no válida.'); }
    const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const caller = await getCaller(request, admin, publicKey);
    if (!caller) return errorResponse('Inicia sesión para continuar.', 401);

    try {
        if (payload?.action === 'assistant_list_students') return await handleAssistantStudents(admin, caller, payload);
        if (payload?.action === 'assistant_list_reports') return await handleAssistantReports(admin, caller, payload);
        if (payload?.action === 'assistant_create_communication') return await handleCreateAssistantCommunication(admin, caller, payload);
        if (payload?.action === 'resolve_qr') return await handleResolveQr(admin, caller, payload);
        if (payload?.action === 'record_assistant_attendance') return await handleAssistantAttendance(admin, caller, payload);
        if (payload?.action === 'justify_assistant_absence') return await handleJustifyAssistantAbsence(admin, caller, payload);
        if (payload?.action === 'create_observation') return await handleCreateObservation(admin, caller, payload);
        if (payload?.action === 'create_citation') return await handleCreateCitation(admin, caller, payload);
        if (payload?.action === 'list_announcements' || payload?.action === 'create_announcement') return await handleClassAnnouncements(admin, caller, payload);
        return errorResponse('La acción solicitada no está disponible.');
    } catch (error) {
        console.error('Teacher tool failed.', error?.message || 'Unknown error');
        return errorResponse('No se pudo completar la solicitud.', 500);
    }
});
