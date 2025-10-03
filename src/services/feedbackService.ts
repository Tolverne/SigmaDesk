/* eslint-disable no-console */
import { supabase } from '../utils/supabase';
import type {
  FeedbackConfig,
  FeedbackEntry,
  FeedbackType,
  CanvasLock,
  CanvasLockScope,
} from '../types/feedback.types';

const nowIso = () => new Date().toISOString();

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ========================== CONFIGS ========================== */

export async function getConfig(
  classId: string,
  lessonId: string,
  slotIndex: number
): Promise<FeedbackConfig | null> {
  const { data, error } = await supabase
    .from('feedback_configs')
    .select('*')
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as FeedbackConfig) ?? null;
}

export async function upsertConfig(input: {
  organization_id: string | null;
  class_id: string;
  course_id: string | null;
  lesson_id: string;
  slot_index: number;
  feedback_type: FeedbackType;
  rubric_id: string | null;
  max_marks: number | null;
  released?: boolean;
}): Promise<FeedbackConfig> {
  const payload = { ...input, updated_at: nowIso() };

  const { data, error } = await supabase
    .from('feedback_configs')
    .upsert(payload, { onConflict: 'class_id,lesson_id,slot_index' })
    .select('*')
    .single();

  if (error) throw error;
  return data as FeedbackConfig;
}

export async function setConfigReleased(
  classId: string,
  lessonId: string,
  slotIndex: number,
  released: boolean
): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('feedback_configs')
    .update({
      released,
      released_at: released ? nowIso() : null,
      released_by: released ? uid : null,
      updated_at: nowIso(),
    })
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex);

  if (error) throw error;
}

/* ========================== ENTRIES ========================== */

export async function listEntriesForClassSlot(
  classId: string,
  lessonId: string,
  slotIndex: number
): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('feedback_entries')
    .select('*')
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex);

  if (error) throw error;
  return (data ?? []) as FeedbackEntry[];
}

export async function getEntry(
  classId: string,
  lessonId: string,
  slotIndex: number,
  studentId: string
): Promise<FeedbackEntry | null> {
  const { data, error } = await supabase
    .from('feedback_entries')
    .select('*')
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as FeedbackEntry) ?? null;
}

export async function upsertEntry(entry: {
  organization_id: string | null;
  class_id: string;
  course_id: string | null;
  lesson_id: string;
  slot_index: number;
  session_id: string | null;
  student_id: string;
  feedback_type: FeedbackType;
  marks: number | null;
  letter: string | null;
  comment: string | null;
  rubric_scores: Record<string, unknown> | null;
}): Promise<FeedbackEntry> {
  const payload = {
    ...entry,
    released: false,
    released_at: null,
    released_by: null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from('feedback_entries')
    .upsert(payload, { onConflict: 'class_id,lesson_id,slot_index,student_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as FeedbackEntry;
}

export async function setEntryReleased(
  classId: string,
  lessonId: string,
  slotIndex: number,
  studentId: string,
  released: boolean
): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('feedback_entries')
    .update({
      released,
      released_at: released ? nowIso() : null,
      released_by: released ? uid : null,
      updated_at: nowIso(),
    })
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('student_id', studentId);

  if (error) throw error;
}

/* ========================== LOCKS ============================ */

export async function getClassLock(
  classId: string,
  lessonId: string,
  slotIndex: number
): Promise<CanvasLock | null> {
  const { data, error } = await supabase
    .from('canvas_locks')
    .select('*')
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('scope', 'class')
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as CanvasLock) ?? null;
}

export async function setClassLock(
  classId: string,
  lessonId: string,
  slotIndex: number,
  locked: boolean,
  lockUntil: string | null
): Promise<CanvasLock> {
  const uid = await currentUserId();
  const payload = {
    class_id: classId,
    lesson_id: lessonId,
    slot_index: slotIndex,
    scope: 'class' as CanvasLockScope,
    student_id: null,
    locked,
    lock_until: lockUntil,
    locked_by: uid,
    updated_at: nowIso(),
  };

  // NOTE: include scope in the conflict target
  try {
    const { data, error } = await supabase
      .from('canvas_locks')
      .upsert(payload, { onConflict: 'class_id,lesson_id,slot_index,scope' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CanvasLock;
  } catch (e: any) {
    console.warn('[feedbackService] setClassLock upsert failed, falling back to update/insert:', e?.message || e);

    // fallback: try update existing row, else insert
    const { data: existing } = await supabase
      .from('canvas_locks')
      .select('*')
      .eq('class_id', classId)
      .eq('lesson_id', lessonId)
      .eq('slot_index', slotIndex)
      .eq('scope', 'class')
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('canvas_locks')
        .update({
          locked,
          lock_until: lockUntil,
          locked_by: uid,
          updated_at: nowIso(),
        })
        .eq('id', (existing as any).id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CanvasLock;
    } else {
      const { data, error } = await supabase
        .from('canvas_locks')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data as CanvasLock;
    }
  }
}

export async function getStudentLock(
  classId: string,
  lessonId: string,
  slotIndex: number,
  studentId: string
): Promise<CanvasLock | null> {
  const { data, error } = await supabase
    .from('canvas_locks')
    .select('*')
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('scope', 'student')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as CanvasLock) ?? null;
}

export async function setStudentLock(
  classId: string,
  lessonId: string,
  slotIndex: number,
  studentId: string,
  locked: boolean,
  lockUntil: string | null
): Promise<CanvasLock> {
  const uid = await currentUserId();
  const payload = {
    class_id: classId,
    lesson_id: lessonId,
    slot_index: slotIndex,
    scope: 'student' as CanvasLockScope,
    student_id: studentId,
    locked,
    lock_until: lockUntil,
    locked_by: uid,
    updated_at: nowIso(),
  };

  // NOTE: include scope AND student_id in the conflict target
  try {
    const { data, error } = await supabase
      .from('canvas_locks')
      .upsert(payload, { onConflict: 'class_id,lesson_id,slot_index,scope,student_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CanvasLock;
  } catch (e: any) {
    console.warn('[feedbackService] setStudentLock upsert failed, falling back to update/insert:', e?.message || e);

    // fallback: try update existing row, else insert
    const { data: existing } = await supabase
      .from('canvas_locks')
      .select('*')
      .eq('class_id', classId)
      .eq('lesson_id', lessonId)
      .eq('slot_index', slotIndex)
      .eq('scope', 'student')
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('canvas_locks')
        .update({
          locked,
          lock_until: lockUntil,
          locked_by: uid,
          updated_at: nowIso(),
        })
        .eq('id', (existing as any).id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CanvasLock;
    } else {
      const { data, error } = await supabase
        .from('canvas_locks')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data as CanvasLock;
    }
  }
}

/** Prefer student lock; if none, use class lock; ignore expired lock_until. */
export async function getEffectiveLock(
  classId: string,
  lessonId: string,
  slotIndex: number,
  studentId: string
): Promise<CanvasLock | null> {
  const [student, classLock] = await Promise.all([
    getStudentLock(classId, lessonId, slotIndex, studentId),
    getClassLock(classId, lessonId, slotIndex),
  ]);
  const lock = student ?? classLock;
  if (!lock || !lock.locked) return null;

  if (lock.lock_until) {
    const until = Date.parse(lock.lock_until);
    if (!Number.isNaN(until) && until <= Date.now()) return null;
  }
  return lock;
}

/* ========================== Facade =========================== */

export const feedbackService = {
  // configs
  getConfig,
  upsertConfig,
  setConfigReleased,

  // entries
  listEntriesForClassSlot,
  getEntry,
  upsertEntry,
  setEntryReleased,

  // locks
  getClassLock,
  setClassLock,
  getStudentLock,
  setStudentLock,
  getEffectiveLock,
};
