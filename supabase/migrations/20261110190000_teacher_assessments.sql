CREATE OR REPLACE FUNCTION public.teacher_can_manage_classroom(
    p_institution_id uuid,
    p_classroom_id uuid,
    p_course_assignment_id uuid DEFAULT NULL,
    p_allow_tutor boolean DEFAULT true
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.memberships AS member
        WHERE member.profile_id = auth.uid()
          AND member.institution_id = p_institution_id
          AND member.status = 'ACTIVE'
          AND member.role = 'TEACHER'
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.course_assignments AS assignment
                  WHERE assignment.institution_id = p_institution_id
                    AND assignment.classroom_id = p_classroom_id
                    AND assignment.teacher_membership_id = member.id
                    AND assignment.status = 'ACTIVE'
                    AND (p_course_assignment_id IS NULL OR assignment.id = p_course_assignment_id)
              )
              OR (
                  p_allow_tutor
                  AND EXISTS (
                      SELECT 1
                      FROM public.classroom_staff AS classroom_staff
                      WHERE classroom_staff.institution_id = p_institution_id
                        AND classroom_staff.classroom_id = p_classroom_id
                        AND classroom_staff.membership_id = member.id
                        AND classroom_staff.assignment_role = 'TUTOR'
                        AND classroom_staff.status = 'ACTIVE'
                  )
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.teacher_can_manage_classroom(uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_manage_classroom(uuid, uuid, uuid, boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.classroom_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id uuid NOT NULL REFERENCES public.institutions(id),
    academic_year_id uuid NOT NULL REFERENCES public.academic_years(id),
    classroom_id uuid NOT NULL REFERENCES public.classrooms(id),
    course_assignment_id uuid REFERENCES public.course_assignments(id),
    title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 120),
    description text,
    assessment_date date NOT NULL,
    maximum_score numeric(8,2) NOT NULL DEFAULT 20 CHECK (maximum_score > 0),
    status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    created_by_membership_id uuid NOT NULL REFERENCES public.memberships(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT classroom_assessments_course_class_check CHECK (course_assignment_id IS NULL OR classroom_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.classroom_assessment_grades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id uuid NOT NULL REFERENCES public.institutions(id),
    assessment_id uuid NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id),
    score numeric(8,2) NOT NULL CHECK (score >= 0),
    feedback text,
    graded_by_membership_id uuid NOT NULL REFERENCES public.memberships(id),
    graded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS classroom_assessments_class_date_idx
    ON public.classroom_assessments (institution_id, classroom_id, assessment_date);
CREATE INDEX IF NOT EXISTS classroom_assessment_grades_assessment_idx
    ON public.classroom_assessment_grades (institution_id, assessment_id);

ALTER TABLE public.classroom_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_assessment_grades ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.classroom_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.classroom_assessment_grades TO authenticated;

DROP POLICY IF EXISTS classroom_assessments_staff_select ON public.classroom_assessments;
DROP POLICY IF EXISTS classroom_assessments_staff_insert ON public.classroom_assessments;
DROP POLICY IF EXISTS classroom_assessments_staff_update ON public.classroom_assessments;
DROP POLICY IF EXISTS classroom_assessment_grades_staff_select ON public.classroom_assessment_grades;
DROP POLICY IF EXISTS classroom_assessment_grades_staff_insert ON public.classroom_assessment_grades;
DROP POLICY IF EXISTS classroom_assessment_grades_staff_update ON public.classroom_assessment_grades;

CREATE POLICY classroom_assessments_staff_select
    ON public.classroom_assessments FOR SELECT TO authenticated
    USING (public.teacher_can_manage_classroom(institution_id, classroom_id, course_assignment_id, true));

CREATE POLICY classroom_assessments_staff_insert
    ON public.classroom_assessments FOR INSERT TO authenticated
    WITH CHECK (
        public.teacher_can_manage_classroom(institution_id, classroom_id, course_assignment_id, true)
        AND EXISTS (
            SELECT 1 FROM public.memberships AS member
            WHERE member.id = created_by_membership_id
              AND member.profile_id = auth.uid()
              AND member.institution_id = classroom_assessments.institution_id
              AND member.status = 'ACTIVE'
              AND member.role = 'TEACHER'
        )
    );

CREATE POLICY classroom_assessments_staff_update
    ON public.classroom_assessments FOR UPDATE TO authenticated
    USING (public.teacher_can_manage_classroom(institution_id, classroom_id, course_assignment_id, true))
    WITH CHECK (public.teacher_can_manage_classroom(institution_id, classroom_id, course_assignment_id, true));

CREATE POLICY classroom_assessment_grades_staff_select
    ON public.classroom_assessment_grades FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classroom_assessments AS assessment
            WHERE assessment.id = assessment_id
              AND assessment.institution_id = classroom_assessment_grades.institution_id
              AND public.teacher_can_manage_classroom(assessment.institution_id, assessment.classroom_id, assessment.course_assignment_id, true)
        )
    );

CREATE POLICY classroom_assessment_grades_staff_insert
    ON public.classroom_assessment_grades FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.classroom_assessments AS assessment
            WHERE assessment.id = assessment_id
              AND assessment.institution_id = classroom_assessment_grades.institution_id
              AND score <= assessment.maximum_score
              AND public.teacher_can_manage_classroom(assessment.institution_id, assessment.classroom_id, assessment.course_assignment_id, false)
        )
        AND EXISTS (
            SELECT 1 FROM public.memberships AS member
            WHERE member.id = graded_by_membership_id
              AND member.profile_id = auth.uid()
              AND member.institution_id = classroom_assessment_grades.institution_id
              AND member.status = 'ACTIVE'
              AND member.role = 'TEACHER'
        )
        AND EXISTS (
            SELECT 1 FROM public.enrollments AS enrollment
            JOIN public.classroom_assessments AS assessment
              ON assessment.id = classroom_assessment_grades.assessment_id
             AND assessment.classroom_id = enrollment.classroom_id
             AND assessment.institution_id = enrollment.institution_id
            WHERE enrollment.student_id = classroom_assessment_grades.student_id
              AND enrollment.institution_id = classroom_assessment_grades.institution_id
              AND enrollment.status = 'ACTIVE'
        )
    );

CREATE POLICY classroom_assessment_grades_staff_update
    ON public.classroom_assessment_grades FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classroom_assessments AS assessment
            WHERE assessment.id = assessment_id
              AND assessment.institution_id = classroom_assessment_grades.institution_id
              AND public.teacher_can_manage_classroom(assessment.institution_id, assessment.classroom_id, assessment.course_assignment_id, false)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.classroom_assessments AS assessment
            WHERE assessment.id = assessment_id
              AND assessment.institution_id = classroom_assessment_grades.institution_id
              AND score <= assessment.maximum_score
              AND public.teacher_can_manage_classroom(assessment.institution_id, assessment.classroom_id, assessment.course_assignment_id, false)
        )
        AND EXISTS (
            SELECT 1 FROM public.memberships AS member
            WHERE member.id = graded_by_membership_id
              AND member.profile_id = auth.uid()
              AND member.institution_id = classroom_assessment_grades.institution_id
              AND member.status = 'ACTIVE'
              AND member.role = 'TEACHER'
        )
        AND EXISTS (
            SELECT 1 FROM public.enrollments AS enrollment
            JOIN public.classroom_assessments AS assessment
              ON assessment.id = classroom_assessment_grades.assessment_id
             AND assessment.classroom_id = enrollment.classroom_id
             AND assessment.institution_id = enrollment.institution_id
             AND assessment.academic_year_id = enrollment.academic_year_id
            WHERE enrollment.student_id = classroom_assessment_grades.student_id
              AND enrollment.institution_id = classroom_assessment_grades.institution_id
              AND enrollment.status = 'ACTIVE'
        )
    );
