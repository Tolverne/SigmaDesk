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
  // async createCanvasSession(lessonId: string, userId: string, slotIndex: number): Promise<CanvasSession> {
  //   const { data, error } = await supabase
  //     .from('canvas_sessions')
  //     .insert({
  //       lesson_id: lessonId,
  //       user_id: userId,
  //       slot_index: slotIndex,
  //       canvasType?: CanvasType,
  //       title: `Canvas ${slotIndex + 1} for Lesson ${lessonId.slice(0, 8)}`,
  //     })
  //     .select()
  //     .single();
  //
  //   if (error) {
  //     // Unique violation → session already exists, fetch it
  //     if ((error as any).code === '23505') {
  //       return this.getCanvasSession(lessonId, userId, slotIndex);
  //     }
  //     throw error;
  //   }
  //   return data as CanvasSession;
  // },
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
  // async getCanvasSession(lessonId: string, userId: string, slotIndex: number, canvasType?: CanvasType): Promise<CanvasSession> {
  //   const { data, error } = await supabase
  //     .from('canvas_sessions')
  //     .select('*')
  //     .eq('lesson_id', lessonId)
  //     .eq('user_id', userId)
  //     .eq('slot_index', slotIndex)
  //     .single();
  //
  //   if (error) {
  //     if ((error as any).code === 'PGRST116') {
  //       // not found → create it
  //       return this.createCanvasSession(lessonId, userId, slotIndex);
  //     }
  //     throw error;
  //   }
  //   return data as CanvasSession;
  // },
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
    // We log verbosely so you can see every insert attempt from the UI.
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
const isTeacherType = (t?: string) => t === 'teacher' || t === 'teacher_example';
// New Start: canonical label we will write/query for teacher boards
const TEACHER_TYPE_DB: CanvasType = 'teacher_example';
// New End

// NEW: get teacher session for a slot (pick the most recently updated one)
async function getLatestTeacherSessionForSlot(lessonId: string, slotIndex: number): Promise<CanvasSession | null> {
  console.log('[resolver] getLatestTeacherSessionForSlot', { lessonId, slotIndex, type: TEACHER_TYPE_DB });
  const { data, error } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', TEACHER_TYPE_DB)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') {
    console.error('[resolver] latest teacher session error:', error);
    throw error;
  }
  return (data as CanvasSession) ?? null;
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

/**
 * NEW: Resolve what to show for a placeholder canvas in a lesson.
 *
 * Rules:
 * - canvas_type = 'student'
 *    - viewer is student  -> their own session (create if missing), read/write
 *    - viewer is teacher  -> carousel of *all* student sessions for that slot, read-only
 * - canvas_type = 'teacher'/'teacher_example'
 *    - viewer is teacher  -> *their* own teacher session (create if missing), read/write
 *    - viewer is student  -> latest teacher session, read-only (if none yet, null → caller may render empty)
 */
export async function resolveCanvasViewForUser(
  params: {
    lessonId: string;
    slotIndex: number;
    canvasType: CanvasType;       // 'student' | 'teacher' | 'teacher_example'
    viewerUserId: string;
    viewerRole: ViewerRole;       // 'student' | 'teacher'
  }
): Promise<ResolvedCanvasView | null> {
  const { lessonId, slotIndex, canvasType, viewerUserId, viewerRole } = params;
  console.log('[resolver] resolveCanvasViewForUser called with', params);

  // STUDENT canvas slot
  if (canvasType === 'student') {
    if (viewerRole === 'student') {
      // Student edits their own board
      const session = await canvasService.getOrCreateSession(lessonId, viewerUserId, slotIndex, 'student');
      return { kind: 'single', session, readOnly: false };
    } else {
      // Teacher reviews student work as a carousel
      const sessions = await getAllStudentSessionsForSlot(lessonId, slotIndex);
      return { kind: 'carousel', sessions, readOnly: true };
    }
  }

  // TEACHER canvas slot (normalize)
  const teacherType: CanvasType = isTeacherType(canvasType) ? TEACHER_TYPE_DB : TEACHER_TYPE_DB;

  if (viewerRole === 'teacher') {
    // Teacher edits their own teacher board for that slot
    const session = await canvasService.getOrCreateSession(lessonId, viewerUserId, slotIndex, teacherType);
    return { kind: 'single', session, readOnly: false };
  } else {
    // Student sees (read-only) the latest teacher board for that slot
    const session = await getLatestTeacherSessionForSlot(lessonId, slotIndex);
    if (!session) return null; // nothing to show yet
    return { kind: 'single', session, readOnly: true };
  }
}


export async function getTeacherExampleSessionIds(lessonId: string, slotIndex: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('canvas_sessions')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', 'teacher_example')
    .order('updated_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.id as string);
}


export async function getMergedStrokesForSessions(sessionIds: string[]): Promise<CanvasStroke[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await supabase
    .from('canvas_strokes')
    .select('id, session_id, stroke_order, stroke_data, created_at')
    .in('session_id', sessionIds)
    .order('stroke_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CanvasStroke[];
}
