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
    const { data: modernRows } = await admin.from('institution_memberships')
        .select('id,institution_id,status,membership_role_assignments(roles(code))')
        .eq('profile_id', data.user.id).eq('status', 'ACTIVE');
    const modernMemberships = (modernRows || []).filter((membership) => {
        const assignments = Array.isArray(membership.membership_role_assignments)
            ? membership.membership_role_assignments
            : [membership.membership_role_assignments].filter(Boolean);
        return assignments.some((assignment) => {
            const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
            return role?.code === 'TEACHER';
        });
    });
    return { user: data.user, memberships: memberships || [], modernMemberships };
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
        academic_year_id: classroom.academic_year_id,
        classroom_id: classroom.id,
        update_type: 'ANNOUNCEMENT',
        title,
        body,
        priority: 'NORMAL',
    }).select('id,title,body,priority,visible_from,created_at').single();
    if (error) return errorResponse('No se pudo publicar el anuncio.', 409);
    return json({ data }, 201);
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
        if (payload?.action === 'resolve_qr') return await handleResolveQr(admin, caller, payload);
        if (payload?.action === 'create_observation') return await handleCreateObservation(admin, caller, payload);
        if (payload?.action === 'create_citation') return await handleCreateCitation(admin, caller, payload);
        if (payload?.action === 'list_announcements' || payload?.action === 'create_announcement') return await handleClassAnnouncements(admin, caller, payload);
        return errorResponse('La acción solicitada no está disponible.');
    } catch (error) {
        console.error('Teacher tool failed.', error?.message || 'Unknown error');
        return errorResponse('No se pudo completar la solicitud.', 500);
    }
});
