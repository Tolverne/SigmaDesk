/* eslint-disable no-console */
import { supabase } from '../utils/supabase';

export type AnalyticsEventType =
  | 'focus' | 'blur' | 'heartbeat'
  | 'stroke' | 'undo' | 'redo' | 'clear'
  | 'playback_open' | 'playback_close';

export type AnalyticsContext = {
  userId: string;
  classId: string | null;
  courseId: string | null;
  lessonId: string | null;
  slotIndex: number | null;
  sessionId?: string | null;
};

type LogArgs = AnalyticsContext & {
  eventType: AnalyticsEventType;
  meta?: Record<string, any>;
};

const REST_URL = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1`;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY ?? '';

/**
 * Minimal row shape. Add optional timing fields here if/when you emit them.
 */
type EventRow = {
  user_id: string;
  class_id: string | null;
  course_id: string | null;
  lesson_id: string | null;
  slot_index: number | null;
  session_id: string | null;
  event_type: string;
  meta?: Record<string, any> | null;
  // Optional timing fields — uncomment/use when needed
  // started_at_ms?: number | null;
  // ended_at_ms?: number | null;
  // duration_ms?: number | null;
  // attempt_index?: number | null;
};

function buildRow(args: LogArgs): EventRow {
  return {
    user_id: args.userId,
    class_id: args.classId ?? null,
    course_id: args.courseId ?? null,
    lesson_id: args.lessonId ?? null,
    slot_index: args.slotIndex ?? null,
    session_id: args.sessionId ?? null,
    event_type: args.eventType,
    meta: args.meta ?? null,
  };
}

/**
 * Post directly to PostgREST with proper auth headers.
 * keepalive ensures delivery when the page is unloading.
 */
async function postEvent(row: EventRow, opts?: { keepalive?: boolean }) {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;

    const res = await fetch(`${REST_URL}/student_activity_events`, {
      method: 'POST',
      keepalive: !!opts?.keepalive,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // No need to read the row back; makes the request cheaper/faster.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const text = await res.text();
      // Best-effort logging: warn but don't throw (avoid breaking UX)
      console.warn('[analytics] post failed', res.status, text);
    }
  } catch (e) {
    console.warn('[analytics] post threw', e);
  }
}

/**
 * When the tab is hidden or unloading, network requests get culled.
 * Heuristically set keepalive in those cases.
 */
function shouldUseKeepalive(): boolean {
  if (typeof document === 'undefined') return false;
  // If page is backgrounded or hidden, prefer keepalive
  return document.visibilityState === 'hidden';
}

export const analyticsService = {
  /**
   * Log a single analytics event.
   * Best-effort: failures are swallowed.
   */
  log: async (args: LogArgs) => {
    const row = buildRow(args);
    await postEvent(row, { keepalive: shouldUseKeepalive() });
  },

  /**
   * Start a periodic heartbeat. Returns a cleanup function to stop it.
   * Default: every 15s.
   */
  startHeartbeat: (ctx: AnalyticsContext, intervalMs = 15000) => {
    let timer: number | null = null;

    const tick = () => {
      analyticsService.log({ ...ctx, eventType: 'heartbeat' }).catch(() => {
        /* no-op */
      });
    };

    // Fire immediately so dashboards feel live
    tick();
    timer = window.setInterval(tick, intervalMs);

    // Also try to send one last heartbeat when the page is hidden/unloading
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        analyticsService.log({ ...ctx, eventType: 'heartbeat' }).catch(() => {});
      }
    };
    const onBeforeUnload = () => {
      analyticsService.log({ ...ctx, eventType: 'heartbeat' }).catch(() => {});
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('beforeunload', onBeforeUnload);
      window.addEventListener('pagehide', onBeforeUnload);
    }

    return () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('pagehide', onBeforeUnload);
      }
    };
  },
};
