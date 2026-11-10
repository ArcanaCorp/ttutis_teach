import { supabase } from '../libs/supabase';

function firstRelation(value) {
    return Array.isArray(value) ? value[0] : value;
}

export async function getStaffSummary(userId) {
    if (!supabase || !userId) return { displayName: '', institutionName: '', role: '' };

    const [profileResult, membershipResult] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
        supabase.from('institution_memberships')
            .select('id, institution_id, institutions(legal_name, trade_name), membership_role_assignments(roles(code, name))')
            .eq('profile_id', userId)
            .eq('status', 'ACTIVE'),
    ]);

    const membership = membershipResult.data?.[0];
    if (!membership) {
        const { data: legacyMembership, error: legacyError } = await supabase.from('memberships')
            .select('id, institution_id, full_name, role, institutions(legal_name, trade_name)')
            .eq('profile_id', userId).eq('status', 'ACTIVE').limit(1).maybeSingle();
        if (legacyMembership) {
            const legacyInstitution = firstRelation(legacyMembership.institutions);
            return {
                displayName: legacyMembership.full_name || profileResult.data?.display_name || '',
                institutionName: legacyInstitution?.trade_name || legacyInstitution?.legal_name || '',
                role: legacyMembership.role || '',
                membershipId: legacyMembership.id,
                institutionId: legacyMembership.institution_id,
                loadError: false,
            };
        }
        return {
            displayName: profileResult.data?.display_name || '',
            institutionName: '',
            role: '',
            membershipId: null,
            institutionId: null,
            loadError: Boolean(profileResult.error || membershipResult.error || legacyError),
        };
    }

    const institution = firstRelation(membership?.institutions);
    const roleAssignments = Array.isArray(membership?.membership_role_assignments)
        ? membership.membership_role_assignments
        : [membership?.membership_role_assignments].filter(Boolean);
    const role = roleAssignments.map((assignment) => firstRelation(assignment?.roles))
        .find((item) => ['TEACHER', 'ASSISTANT'].includes(item?.code)) || firstRelation(roleAssignments[0]?.roles);
    let displayName = profileResult.data?.display_name || '';

    if (!displayName && membership?.institution_id) {
        const { data: link } = await supabase.from('profile_person_links')
            .select('person_id').eq('profile_id', userId).eq('institution_id', membership.institution_id)
            .eq('verification_status', 'VERIFIED').maybeSingle();
        if (link?.person_id) {
            const { data: person } = await supabase.from('people').select('first_names, last_names')
                .eq('id', link.person_id).eq('institution_id', membership.institution_id).maybeSingle();
            displayName = [person?.first_names, person?.last_names].filter(Boolean).join(' ');
        }
    }

    return {
        displayName,
        institutionName: institution?.trade_name || institution?.legal_name || '',
        role: role?.code || '',
        membershipId: membership?.id || null,
        institutionId: membership?.institution_id || null,
        loadError: Boolean(profileResult.error || membershipResult.error),
    };
}

export async function getTeacherSchedule({ userId, institutionId, membershipId }) {
    if (!supabase || !userId || !institutionId) return [];

    const { data: link, error: linkError } = await supabase.from('profile_person_links')
        .select('person_id').eq('profile_id', userId).eq('institution_id', institutionId)
        .eq('verification_status', 'VERIFIED').maybeSingle();
    if (linkError || !link?.person_id) return getLegacyTeacherSchedule({ institutionId, membershipId });

    const { data: staff, error: staffError } = await supabase.from('institution_staff')
        .select('id').eq('institution_id', institutionId).eq('person_id', link.person_id)
        .eq('status', 'ACTIVE').maybeSingle();
    if (staffError || !staff?.id) return getLegacyTeacherSchedule({ institutionId, membershipId });

    const { data: assignments, error: assignmentsError } = await supabase.from('teacher_assignments')
        .select('id, course_offerings(id, name, academic_year_id, section_id, subjects(name), sections(name))')
        .eq('institution_id', institutionId).eq('staff_id', staff.id).eq('status', 'ACTIVE');
    if (assignmentsError || !assignments?.length) return getLegacyTeacherSchedule({ institutionId, membershipId });

    const { data: schedule } = await supabase.from('schedules')
        .select('id, weekday, start_time, end_time, classroom, section_id, course_offering_id, teacher_assignment_id')
        .eq('institution_id', institutionId)
        .in('teacher_assignment_id', assignments.map((assignment) => assignment.id))
        .eq('status', 'ACTIVE')
        .order('weekday').order('start_time');

    const offeringsByAssignment = new Map(assignments.map((assignment) => [assignment.id, firstRelation(assignment.course_offerings)]));
    return (schedule || []).map((item) => {
        const offering = offeringsByAssignment.get(item.teacher_assignment_id);
        const subject = firstRelation(offering?.subjects);
        const section = firstRelation(offering?.sections);
        return {
            ...item,
            subject: subject?.name || offering?.name || 'Clase',
            section: section?.name || 'Aula asignada',
            classroomId: offering?.section_id || item.section_id || null,
            academicYearId: offering?.academic_year_id || null,
            courseAssignmentId: null,
        };
    });
}

async function getLegacyTeacherSchedule({ institutionId, membershipId }) {
    if (!membershipId) return [];
    const { data: assignments, error: assignmentsError } = await supabase.from('course_assignments')
        .select('id, subjects(name), classrooms(grade_label, section_name)')
        .eq('institution_id', institutionId).eq('teacher_membership_id', membershipId).eq('status', 'ACTIVE');
    if (assignmentsError || !assignments?.length) return [];

    const { data: schedule, error: scheduleError } = await supabase.from('schedules')
        .select('id, weekday, start_time, end_time, classroom_label, course_assignment_id')
        .eq('institution_id', institutionId)
        .in('course_assignment_id', assignments.map((assignment) => assignment.id))
        .eq('status', 'ACTIVE').order('weekday').order('start_time');
    if (scheduleError) return [];

    const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    return (schedule || []).map((item) => {
        const assignment = assignmentsById.get(item.course_assignment_id);
        const subject = firstRelation(assignment?.subjects);
        const classroom = firstRelation(assignment?.classrooms);
        return {
            ...item,
            classroom: item.classroom_label || '',
            subject: subject?.name || 'Clase',
            section: classroom ? `${classroom.grade_label} ${classroom.section_name}` : 'Aula asignada',
            classroomId: assignment?.classroom_id || null,
            academicYearId: assignment?.academic_year_id || null,
            courseAssignmentId: assignment?.id || item.course_assignment_id,
        };
    });
}
