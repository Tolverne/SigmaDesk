export type FeedbackType = 'none' | 'marks' | 'letter' | 'text' | 'rubric';

export interface FeedbackConfig {
  id: string;
  organization_id: string | null;
  class_id: string;
  course_id: string | null;
  lesson_id: string;
  slot_index: number;
  feedback_type: FeedbackType;
  rubric_id: string | null;
  max_marks: number | null;
  released: boolean;
  released_at: string | null;
  released_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackEntry {
  id: string;
  organization_id: string | null;
  class_id: string;
  course_id: string | null;
  lesson_id: string;
  slot_index: number;
  session_id: string | null;
  student_id: string; // user_profiles.id
  feedback_type: FeedbackType;
  marks: number | null;
  letter: string | null;
  comment: string | null;
  rubric_scores: Record<string, unknown> | null;
  released: boolean;
  released_at: string | null;
  released_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CanvasLockScope = 'class' | 'student';

export interface CanvasLock {
  id: string;
  organization_id: string | null;
  class_id: string;
  lesson_id: string;
  slot_index: number;
  scope: CanvasLockScope;           // 'class' or 'student'
  student_id: string | null;        // only filled when scope='student'
  locked: boolean;
  lock_until: string | null;        // ISO or null
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}
