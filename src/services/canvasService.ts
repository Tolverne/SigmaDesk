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

    const { data, error } = await supabase
      .from('canvas_sessions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Unique violation → session already exists, fetch it (with same key shape)
      if ((error as any).code === '23505') {
        return this.getCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      throw error;
    }
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

    const { data, error } = await q.single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        // not found → create it with the same type (if provided)
        return this.createCanvasSession(lessonId, userId, slotIndex, canvasType);
      }
      throw error;
    }
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
    const { data, error } = await supabase
      .from('canvas_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data as CanvasSession;
  },

  // Strokes
  async saveStroke(stroke: Omit<CanvasStroke, 'id' | 'created_at'>): Promise<CanvasStroke> {
    const { data, error } = await supabase
      .from('canvas_strokes')
      .insert(stroke)
      .select()
      .single();

    if (error) throw error;
    return data as CanvasStroke;
  },

  async saveStrokesBatch(strokes: Omit<CanvasStroke, 'id' | 'created_at'>[]): Promise<CanvasStroke[]> {
    if (strokes.length === 0) return [];
    const { data, error } = await supabase
      .from('canvas_strokes')
      .insert(strokes)
      .select();

    if (error) throw error;
    return (data || []) as CanvasStroke[];
  },

  async getSessionStrokes(sessionId: string): Promise<CanvasStroke[]> {
    const { data, error } = await supabase
      .from('canvas_strokes')
      .select('*')
      .eq('session_id', sessionId)
      .order('stroke_order'); // unchanged sort

    if (error) throw error;
    return (data || []) as CanvasStroke[];
  },

  async deleteStroke(strokeId: string): Promise<void> {
    const { error } = await supabase.from('canvas_strokes').delete().eq('id', strokeId);
    if (error) throw error;
  },

  async clearCanvas(sessionId: string): Promise<void> {
    const { error } = await supabase.from('canvas_strokes').delete().eq('session_id', sessionId);
    if (error) throw error;
  },

  // Teacher view
  // Old Start: previously included all sessions for a lesson (any type)
  // async getStudentSessions(lessonId: string): Promise<(CanvasSession & { user_name: string })[]> {
  //   const { data, error } = await supabase
  //     .from('canvas_sessions')
  //     .select(`
  //       *,
  //       user_profiles!inner(full_name)
  //     `)
  //     .eq('lesson_id', lessonId)
  //     .order('slot_index', { ascending: true })
  //     .order('updated_at', { ascending: false });
  //
  //   if (error) throw error;
  //   return (data || []).map((session: any) => ({
  //     ...session,
  //     user_name: session.user_profiles?.full_name || 'Unknown',
  //   }));
  // },
  // Old End

  // New Start: only return *student* sessions (teacher view wants to review student work)
  async getStudentSessions(lessonId: string): Promise<(CanvasSession & { user_name: string })[]> {
    const { data, error } = await supabase
      .from('canvas_sessions')
      .select(`
        *,
        user_profiles!inner(full_name)
      `)
      .eq('lesson_id', lessonId)
      .eq('canvas_type', 'student') // filter to student boards
      .order('slot_index', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((session: any) => ({
      ...session,
      user_name: session.user_profiles?.full_name || 'Unknown',
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
  const { data, error } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', TEACHER_TYPE_DB)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as CanvasSession) ?? null;
}

// NEW: get all student sessions for a given slot including user names
async function getAllStudentSessionsForSlot(lessonId: string, slotIndex: number): Promise<(CanvasSession & { user_name: string })[]> {
  const { data, error } = await supabase
    .from('canvas_sessions')
    .select(`
      *,
      user_profiles!inner(full_name)
    `)
    .eq('lesson_id', lessonId)
    .eq('slot_index', slotIndex)
    .eq('canvas_type', 'student')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((s: any) => ({
    ...s,
    user_name: s.user_profiles?.full_name || 'Unknown',
  }));
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
