import { supabase } from '../libs/supabase';

export async function resolveStudentQr(value) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'resolve_qr', value },
    });
    if (error) throw new Error(error.context?.status === 404 ? 'No encontramos al alumno en tus aulas.' : 'No se pudo leer este código QR.');
    return data;
}

export async function createObservation(payload) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'create_observation', ...payload },
    });
    if (error) throw new Error('No se pudo guardar la observación. Inténtalo nuevamente.');
    return data;
}

export async function createClassroomCitation(payload) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'create_citation', ...payload },
    });
    if (error) throw new Error(error.context?.status === 403 ? 'Solo el tutor asignado puede enviar una citación grupal.' : 'No se pudo enviar la citación. Inténtalo nuevamente.');
    return data;
}

async function functionErrorMessage(error, fallback) {
    try {
        const response = error?.context;
        const payload = response?.json ? await response.json() : null;
        if (payload?.error) return payload.error;
    } catch { /* Use the safe fallback if the function response is not JSON. */ }
    return fallback;
}

export async function getClassAnnouncements(classroomId) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'list_announcements', classroomId },
    });
    if (error) throw new Error(await functionErrorMessage(error, 'No se pudieron cargar los anuncios de este curso.'));
    return data?.data || [];
}

export async function createClassAnnouncement({ classroomId, sectionId, courseOfferingId, academicYearId, title, body }) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'create_announcement', classroomId, sectionId, courseOfferingId, academicYearId, title, body },
    });
    if (error) throw new Error(await functionErrorMessage(error, 'No se pudo publicar el anuncio. Verifica que el aula esté asignada a tu cuenta.'));
    return data?.data;
}


export async function recordAssistantAttendance(value) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'record_assistant_attendance', value },
    });
    if (error) throw new Error(await functionErrorMessage(error, 'No se pudo registrar la asistencia.'));
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function justifyAssistantAbsence(eventId, reason) {
    if (!supabase) throw new Error('La conexión con TTUTIS no está disponible.');
    const { data, error } = await supabase.functions.invoke('teacher-tools', {
        body: { action: 'justify_assistant_absence', eventId, reason },
    });
    if (error) throw new Error(await functionErrorMessage(error, 'No se pudo guardar la justificación.'));
    if (data?.error) throw new Error(data.error);
    return data?.data;
}
