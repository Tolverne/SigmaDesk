import { supabase } from '../utils/supabase';
// Old Start: previous imports without CanvasType
// import type { CanvasSession, CanvasStroke } from '../types/canvas.types';
// Old End

// New Start: include CanvasType so we can pass the canvas_type to the DB
import type { CanvasSession, CanvasStroke, CanvasType } from '../types/canvas.types';
// New End

export const canvasService = {
  // Create or fetch a session for a specific slot in the lesson
  // Old Start: original createCanvasSession without canvasType support
  // async createCanvasSession(lessonId: string, userId: string, slotIndex: number): Promise<CanvasSession> { ... }
  // Old End

  // New Start: createCanvasSession now (optionally) accepts a CanvasType and writes to `canvas_type`
  async createCanvasSession(
    lessonId: string,
    userId: string,
    slotIndex: number,
    canvasType?: CanvasType
  ): Promise<CanvasSession> {
    const payload: any = {
      lesson_id: lessonId,
      user_id: userId,
      slot_index: slotIndex,
      title: `Canvas ${slotIndex + 1} for Lesson ${lessonId.slice(0, 8)}`,
    };
    if (canvasType) payload.canvas_type = canvasType;

    console.log('[canvasService.createCanvasSession] inserting session', payload);

    const { data, error } = await supabase
      .from('canvas_sessions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Unique violation → session already exists, fetch it (with same key shape)
      if ((error as any).code === '23505') {
        console.log('[canvasService.createCanvasSession] duplicate → fetching existing');
        return this.getCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      console.error('[canvasService.createCanvasSession] error:', error);
      throw error;
    }
    console.log('[canvasService.createCanvasSession] created OK', data?.id);
    return data as CanvasSession;
  },
  // New End

  // Old Start: original getCanvasSession without canvasType filter and auto-create passing no type
  // async getCanvasSession(...) { ... }
  // Old End

  // New Start: getCanvasSession optionally filters by canvas_type and auto-creates with that same type
  async getCanvasSession(
    lessonId: string,
    userId: string,
    slotIndex: number,
    canvasType?: CanvasType
  ): Promise<CanvasSession> {
    let q = supabase
      .from('canvas_sessions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)
      .eq('slot_index', slotIndex);

    if (canvasType) q = q.eq('canvas_type', canvasType);

    console.log('[canvasService.getCanvasSession] querying', {
      lessonId,
      userId,
      slotIndex,
      canvasType: canvasType ?? '(any)',
    });

    const { data, error } = await q.single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        // not found → create it with the same type (if provided)
        console.log('[canvasService.getCanvasSession] not found → creating');
        return this.createCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      console.error('[canvasService.getCanvasSession] error:', error);
      throw error;
    }
    console.log('[canvasService.getCanvasSession] found', data?.id);
    return data as CanvasSession;
  },
  // New End

  // New Start: convenience helper for callers (keeps keys consistent)
  async getOrCreateSession(
    lessonId: string,
    userId: string,
    slotIndex: number,
    canvasType: CanvasType = 'student'
  ): Promise<CanvasSession> {
    try {
      return await this.getCanvasSession(lessonId, userId, slotIndex, canvasType);
    } catch (err: any) {
      if ((err as any).code === 'PGRST116') {
        return this.createCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      throw err;
    }
  },
  // New End

  async getCanvasSessionById(sessionId: string): Promise<CanvasSession> {
    console.log('[canvasService.getCanvasSessionById] id', sessionId);
    const { data, error } = await supabase
      .from('canvas_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('[canvasService.getCanvasSessionById] error:', error);
      throw error;
    }
    return data as CanvasSession;
  },

  // Strokes
  async saveStroke(stroke: Omit<CanvasStroke, 'id' | 'created_at'>): Promise<CanvasStroke> {
    // IMPORTANT: we do NOT call .select() here to avoid RLS "insert ok / select denied" problems.
    console.log('[canvasService.saveStroke] insert →', {
      session_id: (stroke as any).session_id,
      stroke_order: (stroke as any).stroke_order,
      tool_type: (stroke as any).tool_type,
      width: (stroke as any).stroke_width,
      color: (stroke as any).stroke_color,
      has_points: !!(stroke as any)?.stroke_data?.points?.length,
    });

    const { error } = await supabase.from('canvas_strokes').insert(stroke);

    if (error) {
      console.error('[canvasService.saveStroke] insert failed:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }

    // Fire-and-forget: bump session.updated_at
    void supabase
      .from('canvas_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', (stroke as any).session_id);

    console.log('[canvasService.saveStroke] insert OK (no select).');
    // Echo a minimal stroke so optimistic UI can keep its placeholder
    return { ...(stroke as any), id: undefined, created_at: new Date().toISOString() } as CanvasStroke;
  },

  // New Start: batch insert without returning rows (avoids RLS select issues)
  async saveStrokesBatch(strokes: Omit<CanvasStroke, 'id' | 'created_at'>[]): Promise<CanvasStroke[]> {
    if (strokes.length === 0) return [];
    console.log('[canvasService.saveStrokesBatch] count', strokes.length);

    const { error } = await supabase.from('canvas_strokes').insert(strokes);

    if (error) {
      console.error('[canvasService.saveStrokesBatch] error:', error);
      throw error;
    }
    // Return minimal echoes
    const now = new Date().toISOString();
    return strokes.map((s) => ({ ...(s as any), id: undefined, created_at: now } as CanvasStroke));
  },
  // New End

  async getSessionStrokes(sessionId: string): Promise<CanvasStroke[]> {
    console.log('[canvasService.getSessionStrokes] session', sessionId);
    const { data, error } = await supabase
      .from('canvas_strokes')
      .select('*')
      .eq('session_id', sessionId)
      .order('stroke_order', { ascending: true }); // explicit sort

    console.log('[canvasService.getSessionStrokes]', sessionId, '→', (data || []).length, 'rows');

    if (error) {
      console.error('[canvasService.getSessionStrokes] error:', error);
      throw error;
    }
    return (data || []) as CanvasStroke[];
  },

  async deleteStroke(strokeId: string): Promise<void> {
    console.log('[canvasService.deleteStroke] id', strokeId);
    const { error } = await supabase.from('canvas_strokes').delete().eq('id', strokeId);
    if (error) {
      console.error('[canvasService.deleteStroke] error:', error);
      throw error;
    }
  },

  async clearCanvas(sessionId: string): Promise<void> {
    console.log('[canvasService.clearCanvas] session', sessionId);
    const { error } = await supabase.from('canvas_strokes').delete().eq('session_id', sessionId);
    if (error) {
      console.error('[canvasService.clearCanvas] error:', error);
      throw error;
    }
  },

  // Teacher view
  async getStudentSessions(lessonId: string): Promise<(CanvasSession & { user_name: string })[]> {
    const { data: sessions, error } = await supabase
      .from('canvas_sessions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('canvas_type', 'student')
      .order('slot_index', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (!sessions || sessions.length === 0) return [];

    const userIds = Array.from(new Set(sessions.map((s: any) => s.user_id).filter(Boolean)));
    let namesById: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profErr) {
        console.warn('[canvasService] profiles fetch failed in getStudentSessions:', profErr.message);
      } else if (profiles) {
        namesById = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Unknown';
          return acc;
        }, {});
      }
    }

    return (sessions as any[]).map((s) => ({
      ...s,
      user_name: namesById[s.user_id] || 'Unknown',
    }));
  },
  // New End
};

// --- IndexedDB Offline Service (unchanged except sessions include slot_index) ---
export const offlineCanvasService = {
  dbName: 'SigmaCanvas',
  version: 2, // bumped for new schema if needed

  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('lesson_user_slot', ['lesson_id', 'user_id', 'slot_index'], { unique: true });
        }

        if (!db.objectStoreNames.contains('strokes')) {
          const strokeStore = db.createObjectStore('strokes', { keyPath: 'localId' });
          strokeStore.createIndex('session_id', 'session_id');
          strokeStore.createIndex('needs_sync', 'needs_sync');
        }
      };
    });
  },

  async saveSessionOffline(session: CanvasSession): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(['sessions'], 'readwrite');
    const store = tx.objectStore('sessions');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ ...session, needs_sync: true });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async saveStrokeOffline(stroke: CanvasStroke & { needs_sync: boolean }): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(['strokes'], 'readwrite');
    const store = tx.objectStore('strokes');

    const localStroke = {
      ...stroke,
      localId: `local_${Date.now()}_${Math.random()}`,
      needs_sync: true,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(localStroke);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async getOfflineStrokes(sessionId: string): Promise<CanvasStroke[]> {
    const db = await this.openDB();
    const tx = db.transaction(['strokes'], 'readonly');
    const store = tx.objectStore('strokes');
    const index = store.index('session_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(sessionId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result || []) as any[]);
    });
  },

  async syncPendingData(): Promise<void> {
    const db = await this.openDB();

    // Read all strokes and filter those needing sync (boolean true or numeric 1)
    const tx = db.transaction(['strokes'], 'readwrite');
    const store = tx.objectStore('strokes');

    const all: any[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });

    const pending = all.filter((s) => s.needs_sync === true || s.needs_sync === 1);

    for (const stroke of pending) {
      try {
        const { localId, needs_sync, ...clean } = stroke;
        await canvasService.saveStroke(clean);
        await new Promise<void>((resolve, reject) => {
          const del = store.delete(localId);
          del.onerror = () => reject(del.error);
          del.onsuccess = () => resolve();
        });
      } catch (err) {
        // keep for next pass
        // eslint-disable-next-line no-console
        console.error('Failed to sync stroke:', err);
      }
    }
  },
};

// canvasService.ts (ADD THESE TYPES + FUNCTIONS)

// NEW: a helper type for the viewer
export type ViewerRole = 'teacher' | 'student';

// NEW: the shape returned by the resolver
export type ResolvedCanvasView =
  | { kind: 'single'; session: CanvasSession; readOnly: boolean }
  | { kind: 'carousel'; sessions: (CanvasSession & { user_name: string })[]; readOnly: boolean };

// NEW: normalize teacher type label (your DB might use 'teacher' or 'teacher_example')
const isTeacherType = (t?: string) => t === 'teacher' || t === 'class';
// New Start: canonical label we will write/query for teacher boards
const TEACHER_TYPE_DB: CanvasType = 'class';
// New End

// NEW: get teacher session for a slot (pick the most recently updated one)
async function getLatestClassSessionForSlot(
  lessonId: string, 
  slotIndex: number,
  classId?: string
): Promise<CanvasSession | null> {
  console.log('[resolver] getLatestClassSessionForSlot', { lessonId, slotIndex, classId, type: TEACHER_TYPE_DB });
  
  let query = supabase
    .from('canvas_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', TEACHER_TYPE_DB);
  
  // If classId provided, filter by it; otherwise get the most recent one
  if (classId) {
    query = query.eq('class_id', classId);
  }
  
  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') {
    console.error('[resolver] latest class session error:', error);
    throw error;
  }
  return (data as CanvasSession) ?? null;
}



export async function getClassIdForLessonAndUser(
  lessonId: string,
  userId: string,
  role: ViewerRole
): Promise<string | null> {
  console.log('[canvasService] getClassIdForLessonAndUser', { lessonId, userId, role });
  
  if (role === 'student') {
    return getStudentClassForLesson(userId, lessonId);
  } else {
    return getTeacherClassForLesson(userId, lessonId);
  }
}



// Helper: Get student's class for a specific lesson
async function getStudentClassForLesson(
  studentId: string,
  lessonId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_student_class_for_lesson', {
      student_user_id: studentId,
      lesson_id_param: lessonId,
    });
    
    if (error) {
      console.warn('[canvasService] get_student_class_for_lesson RPC failed:', error.message);
      return null;
    }
    return data as string | null;
  } catch (err) {
    console.warn('[canvasService] getStudentClassForLesson error:', err);
    return null;
  }
}




async function getTeacherClassForLesson(
  teacherId: string,
  lessonId: string
): Promise<string | null> {
  try {
    // 1. Get course_id from lesson
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('topic_id, topics(course_id)')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      console.warn('[canvasService] Could not resolve course from lesson:', lessonError?.message);
      return null;
    }

    const courseId = (lessonData as any)?.topics?.course_id;
    if (!courseId) {
      console.warn('[canvasService] Lesson has no course_id');
      return null;
    }

    // 2. Find teacher's classes for this course (separate queries)
    // First get all classes for this course
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('course_id', courseId);

    if (classError || !classes || classes.length === 0) {
      console.warn('[canvasService] No classes for this course');
      return null;
    }

    const classIds = classes.map((c: any) => c.id);

    // Then find which ones this teacher is assigned to
    const { data: classTeachers, error: ctError } = await supabase
      .from('class_teachers')
      .select('class_id, is_primary')
      .eq('user_id', teacherId)
      .in('class_id', classIds);

    if (ctError || !classTeachers || classTeachers.length === 0) {
      console.warn('[canvasService] Teacher has no classes for this course');
      return null;
    }

    // 3. Prefer primary class
    const primaryClass = classTeachers.find((ct: any) => ct.is_primary);
    const selectedClass = primaryClass || classTeachers[0];
    
    console.log('[canvasService] Resolved teacher class:', {
      teacherId,
      lessonId,
      courseId,
      classId: selectedClass.class_id,
      isPrimary: !!primaryClass,
    });

    return selectedClass.class_id;
  } catch (err) {
    console.warn('[canvasService] getTeacherClassForLesson error:', err);
    return null;
  }
}








// Helper: Check if user is a teacher for a specific class
async function isTeacherForClass(
  userId: string,
  classId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_teacher_for_class', {
      user_id: userId,
      check_class_id: classId,
    });
    
    if (error) {
      console.warn('[canvasService] is_teacher_for_class RPC failed:', error.message);
      return false;
    }
    return !!data;
  } catch (err) {
    console.warn('[canvasService] isTeacherForClass error:', err);
    return false;
  }
}

// Helper: Get or create a class canvas
async function getOrCreateClassCanvas(
  lessonId: string,
  classId: string,
  slotIndex: number,
  teacherId: string
): Promise<CanvasSession> {
  console.log('[canvasService] getOrCreateClassCanvas', { lessonId, classId, slotIndex });

  // Try to find existing class canvas
  const { data: existing, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('class_id', classId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', 'class')
    .maybeSingle();

  if (fetchError && (fetchError as any).code !== 'PGRST116') {
    throw fetchError;
  }

  if (existing) {
    console.log('[canvasService] found existing class canvas:', existing.id);
    return existing as CanvasSession;
  }

  // Create new class canvas
  const { data: created, error: createError } = await supabase
    .from('canvas_sessions')
    .insert({
      lesson_id: lessonId,
      user_id: teacherId, // Use the requesting teacher as the creator
      class_id: classId,
      slot_index: slotIndex,
      canvas_type: 'class',
      title: `Class Canvas ${slotIndex + 1}`,
    })
    .select()
    .single();

  if (createError) {
    console.error('[canvasService] failed to create class canvas:', createError);
    throw createError;
  }

  console.log('[canvasService] created new class canvas:', created.id);
  return created as CanvasSession;
}



// NEW: get all student sessions for a given slot including user names
async function getAllStudentSessionsForSlot(
  lessonId: string,
  slotIndex: number
): Promise<(CanvasSession & { user_name: string })[]> {
  // 1) Fetch the student sessions for that slot
  const { data: sessions, error } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', 'student')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  if (!sessions || sessions.length === 0) {
    console.log('[canvasService] No student sessions for slot', { lessonId, slotIndex });
    return [];
  }

  // 2) Fetch the display names in one go
  const userIds = Array.from(new Set(sessions.map((s: any) => s.user_id).filter(Boolean)));
  let namesById: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profErr) {
      console.warn('[canvasService] profiles lookup failed, will default names to Unknown:', profErr.message);
    } else if (profiles) {
      namesById = profiles.reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.full_name || 'Unknown';
        return acc;
      }, {});
    }
  }

  const result = (sessions as any[]).map((s) => ({
    ...s,
    user_name: namesById[s.user_id] || 'Unknown',
  }));

  console.log('[canvasService] Student sessions resolved for slot', { lessonId, slotIndex, count: result.length });
  return result;
}

export async function resolveCanvasViewForUser(
  params: {
    lessonId: string;
    slotIndex: number;
    canvasType: CanvasType;       // 'student' | 'class'
    viewerUserId: string;
    viewerRole: ViewerRole;       // 'student' | 'teacher'
    classId?: string;             // Optional: if known, use this class
    createIfMissing?: boolean;    // default true
  }
): Promise<ResolvedCanvasView | null> {
  const {
    lessonId,
    slotIndex,
    canvasType,
    viewerUserId,
    viewerRole,
    classId,
    createIfMissing = true,
  } = params;

  console.log('[resolver] resolveCanvasViewForUser called with', params);

  // STUDENT canvas slot
  if (canvasType === 'student') {
    if (viewerRole === 'student') {
      // Student edits their own board
      const session = createIfMissing
        ? await canvasService.getOrCreateSession(lessonId, viewerUserId, slotIndex, 'student')
        : await canvasService.getCanvasSession(lessonId, viewerUserId, slotIndex, 'student');
      return { kind: 'single', session, readOnly: false };
    } else {
      // Teacher reviews student work as a carousel
      const sessions = await getAllStudentSessionsForSlot(lessonId, slotIndex);
      return { kind: 'carousel', sessions, readOnly: true };
    }
  }

  // CLASS canvas slot
  if (canvasType === 'class') {
    if (viewerRole === 'student') {
      // Student views their class's canvas (read-only)
      const studentClassId = classId || await getStudentClassForLesson(viewerUserId, lessonId);

      if (!studentClassId) {
        console.warn('[resolver] Student not enrolled in any class for this lesson');
        return null;
      }

      const session = await getLatestClassSessionForSlot(lessonId, slotIndex, studentClassId);
      if (!session && createIfMissing) {
        // If no class canvas exists yet, show null (teacher hasn't created one yet)
        return null;
      }
      return session ? { kind: 'single', session, readOnly: true } : null;
      
    } else {
      // Teacher edits class canvas
      // For now, we need to know which class - we'll need to pass this from context
      // If classId not provided, try to infer from the teacher's classes
      let effectiveClassId = classId;
      
      if (!effectiveClassId) {
        console.warn('[resolver] Teacher viewing class canvas without classId context');
        // For now, return null - we'll need UI to select a class
        return null;
      }

      // Verify teacher has access to this class
      const hasAccess = await isTeacherForClass(viewerUserId, effectiveClassId);
      if (!hasAccess) {
        console.warn('[resolver] Teacher does not have access to class:', effectiveClassId);
        return null;
      }

      const session = createIfMissing
        ? await getOrCreateClassCanvas(lessonId, effectiveClassId, slotIndex, viewerUserId)
        : await getLatestClassSessionForSlot(lessonId, slotIndex, effectiveClassId);

      return session ? { kind: 'single', session, readOnly: false } : null;
    }
  }

  return null;
}


export async function getClassCanvasSessionIds(
  lessonId: string, 
  slotIndex: number,
  classId?: string
): Promise<string[]> {
  let query = supabase
    .from('canvas_sessions')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', 'class');
  
  if (classId) {
    query = query.eq('class_id', classId);
  }

  const { data, error } = await query.order('updated_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.id as string);
}

// Keep the old function name as an alias for backwards compatibility (temporary)
export async function getTeacherExampleSessionIds(lessonId: string, slotIndex: number): Promise<string[]> {
  console.warn('[canvasService] getTeacherExampleSessionIds is deprecated, use getClassCanvasSessionIds');
  return getClassCanvasSessionIds(lessonId, slotIndex);
}

// Old Start: time-normalizing merge (timestamp-based with fallbacks)
// export async function getMergedStrokesForSessions(sessionIds: string[]): Promise<CanvasStroke[]> { ... }
// Old End

// New Start: strict ORDER-BASED merge (primary: stroke_order; fallback: created_at)
export async function getMergedStrokesForSessions(sessionIds: string[]): Promise<CanvasStroke[]> {
  if (!sessionIds?.length) return [];

  const { data, error } = await supabase
    .from('canvas_strokes')
    .select('id, session_id, stroke_data, tool_type, stroke_color, stroke_width, timestamp_ms, stroke_order, created_at')
    .in('session_id', sessionIds)
    // DB-side ordering helps; we still enforce sort in JS for safety
    .order('stroke_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    session_id: string;
    stroke_data: any;             // JSON or stringified JSON
    tool_type: string;
    stroke_color: string;
    stroke_width: number;
    timestamp_ms: number | null;
    stroke_order: number | null;
    created_at: string | null;
  };

  const rows = (data ?? []) as Raw[];

  const parsed: CanvasStroke[] = rows.map((r) => {
    let sd: any = r.stroke_data;
    if (sd && typeof sd === 'string') {
      try { sd = JSON.parse(sd); } catch { /* leave as string if invalid */ }
    }
    return {
      id: r.id,
      session_id: r.session_id,
      stroke_data: sd,
      tool_type: r.tool_type,
      stroke_color: r.stroke_color,
      stroke_width: r.stroke_width,
      // Keep originals; player will ignore timestamps and use order
      timestamp_ms: r.timestamp_ms ?? undefined,
      stroke_order: r.stroke_order ?? undefined,
      created_at: r.created_at ?? undefined,
    } as CanvasStroke;
  });

  // Enforce a stable, order-first sort in JS:
  const byOrder = (a: CanvasStroke, b: CanvasStroke) => {
    const ao = (a as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
    const bo = (b as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const ac = (a as any).created_at ? Date.parse((a as any).created_at) : 0;
    const bc = (b as any).created_at ? Date.parse((b as any).created_at) : 0;
    if (ac !== bc) return ac - bc;
    // final tiebreaker: id
    return String((a as any).id).localeCompare(String((b as any).id));
  };

  return parsed.sort(byOrder);
}
// New End
