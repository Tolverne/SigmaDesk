import { supabase } from '../utils/supabase';
import type { CanvasSession, CanvasStroke } from '../types/canvas.types';

export const canvasService = {
  // Create or fetch a session for a specific slot in the lesson
  async createCanvasSession(lessonId: string, userId: string, slotIndex: number): Promise<CanvasSession> {
    const { data, error } = await supabase
      .from('canvas_sessions')
      .insert({
        lesson_id: lessonId,
        user_id: userId,
        slot_index: slotIndex,
        title: `Canvas ${slotIndex + 1} for Lesson ${lessonId.slice(0, 8)}`,
      })
      .select()
      .single();

    if (error) {
      // Unique violation → session already exists, fetch it
      if ((error as any).code === '23505') {
        return this.getCanvasSession(lessonId, userId, slotIndex);
      }
      throw error;
    }
    return data as CanvasSession;
  },

  async getCanvasSession(lessonId: string, userId: string, slotIndex: number): Promise<CanvasSession> {
    const { data, error } = await supabase
      .from('canvas_sessions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)
      .eq('slot_index', slotIndex)
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        // not found → create it
        return this.createCanvasSession(lessonId, userId, slotIndex);
      }
      throw error;
    }
    return data as CanvasSession;
  },

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
      .order('stroke_order');

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
  async getStudentSessions(lessonId: string): Promise<(CanvasSession & { user_name: string })[]> {
    const { data, error } = await supabase
      .from('canvas_sessions')
      .select(`
        *,
        user_profiles!inner(full_name)
      `)
      .eq('lesson_id', lessonId)
      .order('slot_index', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((session: any) => ({
      ...session,
      user_name: session.user_profiles?.full_name || 'Unknown',
    }));
  },
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
