CREATE OR REPLACE FUNCTION private.can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
 select exists (
  select 1 from public.students s
  join public.memberships m on m.id=s.membership_id
  where s.id=p_student_id and m.profile_id=(select auth.uid())
    and m.role='STUDENT' and m.status='ACTIVE'
 )
 or exists (
  select 1 from public.guardian_student_links gl
  where gl.student_id=p_student_id and gl.guardian_profile_id=(select auth.uid())
    and gl.status='ACTIVE'
 )
 or exists (
  select 1 from public.students s
  join public.memberships m on m.institution_id=s.institution_id
  where s.id=p_student_id and m.profile_id=(select auth.uid())
    and m.role='ASSISTANT' and m.status='ACTIVE'
 )
 or exists (
  select 1 from public.enrollments e
  join public.classroom_staff cs on cs.classroom_id=e.classroom_id
  join public.memberships m on m.id=cs.membership_id
  where e.student_id=p_student_id and e.status='ACTIVE'
    and cs.status='ACTIVE' and m.profile_id=(select auth.uid())
    and m.status='ACTIVE' and m.role in ('TEACHER','ASSISTANT')
 )
 or exists (
  select 1 from public.enrollments e
  join public.course_assignments ca on ca.classroom_id=e.classroom_id
  join public.memberships m on m.id=ca.teacher_membership_id
  where e.student_id=p_student_id and e.status='ACTIVE'
    and ca.status='ACTIVE' and m.profile_id=(select auth.uid())
    and m.status='ACTIVE' and m.role='TEACHER'
 )
$function$;

CREATE OR REPLACE FUNCTION private.can_read_update(p_institution_id uuid, p_student_id uuid, p_classroom_id uuid, p_update_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
 select private.is_institution_admin(p_institution_id)
 or (
  p_student_id is null and p_classroom_id is null
  and p_update_type='ANNOUNCEMENT'
  and private.can_access_institution(p_institution_id)
 )
 or (
  p_student_id is not null
  and (
   exists (
    select 1 from public.students s join public.memberships m on m.id=s.membership_id
    where s.id=p_student_id and m.profile_id=(select auth.uid())
      and m.role='STUDENT' and m.status='ACTIVE'
   )
   or private.guardian_can_view(
     p_student_id,
     case
      when p_update_type='GRADE' then 'GRADES'
      when p_update_type in ('BEHAVIOR','CITATION') then 'BEHAVIOR'
      else 'NOTIFICATIONS'
     end
   )
   or private.has_institution_role(p_institution_id,array['ASSISTANT']::text[])
   or (
    private.has_institution_role(p_institution_id,array['TEACHER']::text[])
    and (
     exists (
      select 1 from public.enrollments e
      join public.classroom_staff cs on cs.classroom_id=e.classroom_id
      join public.memberships m on m.id=cs.membership_id
      where e.student_id=p_student_id and e.status='ACTIVE'
        and cs.status='ACTIVE' and m.profile_id=(select auth.uid())
     )
     or exists (
      select 1 from public.enrollments e
      join public.course_assignments ca on ca.classroom_id=e.classroom_id
      join public.memberships m on m.id=ca.teacher_membership_id
      where e.student_id=p_student_id and e.status='ACTIVE'
        and ca.status='ACTIVE' and m.profile_id=(select auth.uid())
     )
    )
   )
  )
 )
 or (
  p_classroom_id is not null
  and (
   private.can_access_classroom(p_classroom_id)
   or private.has_institution_role(p_institution_id,array['ASSISTANT']::text[])
  )
 )
$function$;
