import { supabase } from '../utils/supabase';
import type { CanvasSession, CanvasStroke, CanvasType } from '../types/canvas.types';

export const canvasService = {
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
        console.log('[canvasService.getCanvasSession] not found → creating');
        return this.createCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      console.error('[canvasService.getCanvasSession] error:', error);
      throw error;
    }
    console.log('[canvasService.getCanvasSession] found', data?.id);
    return data as CanvasSession;
  },

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

  async saveStroke(stroke: Omit<CanvasStroke, 'id' | 'created_at'>): Promise<CanvasStroke> {
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

    void supabase
      .from('canvas_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', (stroke as any).session_id);

    console.log('[canvasService.saveStroke] insert OK (no select).');
    return { ...(stroke as any), id: undefined, created_at: new Date().toISOString() } as CanvasStroke;
  },

  async saveStrokesBatch(strokes: Omit<CanvasStroke, 'id' | 'created_at'>[]): Promise<CanvasStroke[]> {
    if (strokes.length === 0) return [];
    console.log('[canvasService.saveStrokesBatch] count', strokes.length);

    const { error } = await supabase.from('canvas_strokes').insert(strokes);

    if (error) {
      console.error('[canvasService.saveStrokesBatch] error:', error);
      throw error;
    }
    const now = new Date().toISOString();
    return strokes.map((s) => ({ ...(s as any), id: undefined, created_at: now } as CanvasStroke));
  },

  async getSessionStrokes(sessionId: string): Promise<CanvasStroke[]> {
    console.log('[canvasService.getSessionStrokes] session', sessionId);
    const { data, error } = await supabase
      .from('canvas_strokes')
      .select('*')
      .eq('session_id', sessionId)
      .order('stroke_order', { ascending: true });

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
};

// --- IndexedDB Offline Service ---
export const offlineCanvasService = {
  dbName: 'SigmaCanvas',
  version: 2,

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
        console.error('Failed to sync stroke:', err);
      }
    }
  },
};

// --- Canvas View Resolution Types and Functions ---

export type ViewerRole = 'teacher' | 'student';

export type ResolvedCanvasView =
  | { kind: 'single'; session: CanvasSession; readOnly: boolean }
  | { kind: 'carousel'; sessions: (CanvasSession & { user_name: string })[]; readOnly: boolean };

const TEACHER_TYPE_DB: CanvasType = 'class';

// REMOVED: getClassIdForLessonAndUser - no longer needed with class-aware URLs
// REMOVED: getTeacherClassForLesson - no longer needed with class-aware URLs

// KEPT: Helper for students to find their class (used in LessonRedirect and resolveCanvasViewForUser)
export async function getStudentClassForLesson(
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

async function isTeacherForClass(
  userId: string,
  classId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_teacher_for_class', {
      check_user_id: userId,  // CHANGED: was user_id
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

async function getOrCreateClassCanvas(
  lessonId: string,
  classId: string,
  slotIndex: number,
  teacherId: string
): Promise<CanvasSession> {
  console.log('[canvasService] getOrCreateClassCanvas', { lessonId, classId, slotIndex });

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

  const { data: created, error: createError } = await supabase
    .from('canvas_sessions')
    .insert({
      lesson_id: lessonId,
      user_id: teacherId,
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

async function getAllStudentSessionsForSlot(
  lessonId: string,
  slotIndex: number
): Promise<(CanvasSession & { user_name: string })[]> {
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

  const userIds = Array.from(new Set(sessions.map((s: any) => s.user_id).filter(Boolean)));
  let namesById: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profErr) {
      console.warn('[canvasService] profiles lookup failed:', profErr.message);
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

  console.log('[canvasService] Student sessions for slot', { lessonId, slotIndex, count: result.length });
  return result;
}

export async function resolveCanvasViewForUser(
  params: {
    lessonId: string;
    slotIndex: number;
    canvasType: CanvasType;
    viewerUserId: string;
    viewerRole: ViewerRole;
    classId?: string;
    createIfMissing?: boolean;
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

  console.log('[resolver] resolveCanvasViewForUser', params);

  // STUDENT canvas slot
  if (canvasType === 'student') {
    if (viewerRole === 'student') {
      const session = createIfMissing
        ? await canvasService.getOrCreateSession(lessonId, viewerUserId, slotIndex, 'student')
        : await canvasService.getCanvasSession(lessonId, viewerUserId, slotIndex, 'student');
      return { kind: 'single', session, readOnly: false };
    } else {
      const sessions = await getAllStudentSessionsForSlot(lessonId, slotIndex);
      return { kind: 'carousel', sessions, readOnly: true };
    }
  }

  // CLASS canvas slot
  if (canvasType === 'class') {
    if (viewerRole === 'student') {
      const studentClassId = classId || await getStudentClassForLesson(viewerUserId, lessonId);

      if (!studentClassId) {
        console.warn('[resolver] Student not enrolled in class for this lesson');
        return null;
      }

      const session = await getLatestClassSessionForSlot(lessonId, slotIndex, studentClassId);
      if (!session && createIfMissing) {
        return null;
      }
      return session ? { kind: 'single', session, readOnly: true } : null;
      
    } else {
      // Teacher must have classId from URL
      if (!classId) {
        console.warn('[resolver] Teacher viewing class canvas without classId - should select class first');
        return null;
      }

      const hasAccess = await isTeacherForClass(viewerUserId, classId);
      if (!hasAccess) {
        console.warn('[resolver] Teacher does not have access to class:', classId);
        return null;
      }

      const session = createIfMissing
        ? await getOrCreateClassCanvas(lessonId, classId, slotIndex, viewerUserId)
        : await getLatestClassSessionForSlot(lessonId, slotIndex, classId);

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

// Deprecated alias
export async function getTeacherExampleSessionIds(lessonId: string, slotIndex: number): Promise<string[]> {
  console.warn('[canvasService] getTeacherExampleSessionIds is deprecated, use getClassCanvasSessionIds');
  return getClassCanvasSessionIds(lessonId, slotIndex);
}

export async function getMergedStrokesForSessions(sessionIds: string[]): Promise<CanvasStroke[]> {
  if (!sessionIds?.length) return [];

  const { data, error } = await supabase
    .from('canvas_strokes')
    .select('id, session_id, stroke_data, tool_type, stroke_color, stroke_width, timestamp_ms, stroke_order, created_at')
    .in('session_id', sessionIds)
    .order('stroke_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    session_id: string;
    stroke_data: any;
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
      try { sd = JSON.parse(sd); } catch { /* invalid JSON */ }
    }
    return {
      id: r.id,
      session_id: r.session_id,
      stroke_data: sd,
      tool_type: r.tool_type,
      stroke_color: r.stroke_color,
      stroke_width: r.stroke_width,
      timestamp_ms: r.timestamp_ms ?? undefined,
      stroke_order: r.stroke_order ?? undefined,
      created_at: r.created_at ?? undefined,
    } as CanvasStroke;
  });

  const byOrder = (a: CanvasStroke, b: CanvasStroke) => {
    const ao = (a as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
    const bo = (b as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const ac = (a as any).created_at ? Date.parse((a as any).created_at) : 0;
    const bc = (b as any).created_at ? Date.parse((b as any).created_at) : 0;
    if (ac !== bc) return ac - bc;
    return String((a as any).id).localeCompare(String((b as any).id));
  };

  return parsed.sort(byOrder);
}