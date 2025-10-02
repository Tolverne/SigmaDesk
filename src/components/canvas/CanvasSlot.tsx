/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasType } from '../../types/canvas.types';
import {
  resolveCanvasViewForUser,
  ViewerRole,
  ResolvedCanvasView,
} from '../../services/canvasService';
import CanvasWorkspace from './CanvasWorkspace';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import { supabase } from '../../utils/supabase';

// Old Start
// (previously we only used CanvasWorkspace overlays for student@teacher_example)
// Old End

// New Start: merged playback (order-based) for teacher_example view
import CanvasPlayback from './CanvasPlayback';
import { getTeacherExampleSessionIds } from '../../services/canvasService';
// New End

type CanvasSlotProps = {
  className?: string;
  lessonId: string;
  slotIndex: number;
  canvasType: CanvasType; // 'student' | 'teacher_example'
};

const roleFromString = (s?: string): ViewerRole => (s === 'teacher' ? 'teacher' : 'student');

const CanvasSlot: React.FC<CanvasSlotProps> = ({
  className,
  lessonId,
  slotIndex,
  canvasType,
}) => {
  const { user } = useAuth();

  const [view, setView] = useState<ResolvedCanvasView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const viewerUserId = user?.id || '';

  // Role resolution (AuthContext preferred; fallback to user_profiles)
  const [viewerRole, setViewerRole] = useState<ViewerRole>('student');

  // New Start: list of ALL teacher_example sessions (for student merged playback)
  const [teacherSessionIds, setTeacherSessionIds] = useState<string[] | null>(null);
  const [teacherSessionsLoading, setTeacherSessionsLoading] = useState<boolean>(false);
  // New End

  useEffect(() => {
    let cancelled = false;

    const resolveRole = async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        if (!viewerUserId) {
          console.warn('[CanvasSlot] No user session yet → defaulting role to student');
          setViewerRole('student');
          return;
        }

        const { data: prof, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', viewerUserId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn('[CanvasSlot] fetch role failed, defaulting student:', error.message);
          setViewerRole('student');
        } else {
          setViewerRole(roleFromString(prof?.role));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolveRole();
    return () => {
      cancelled = true;
    };
  }, [viewerUserId]);

  // Resolve what to render for this slot (single vs carousel + sessionId/readOnly)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        if (!lessonId && !slotIndex) {
          setErrMsg('Invalid canvas slot');
          return;
        }

        const uid = viewerUserId || 'anonymous';

        console.log('[CanvasSlot] Resolving view →', {
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: uid,
          viewerRole,
        });

        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,       // 'student' | 'teacher_example'
          viewerUserId: uid,
          viewerRole,       // 'student' | 'teacher'
          // Guard: don’t create a student session when viewing teacher_example
          createIfMissing: !(viewerRole === 'student' && canvasType === 'teacher_example'),
        } as any);

        if (cancelled) return;

        if (!v) {
          console.log('[CanvasSlot] No resolved view (likely no teacher board yet).');
          setView(null);
          return;
        }

        setView(v);
      } catch (e: any) {
        console.error('[CanvasSlot] resolve failed:', e);
        setErrMsg(e?.message || 'Failed to prepare canvas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (viewerRole) run();
    return () => {
      cancelled = true;
    };
  }, [lessonId, slotIndex, canvasType, viewerUserId, viewerRole]);

  // New Start: For student@teacher_example, fetch ALL teacher session IDs (for merged playback)
  useEffect(() => {
    let cancelled = false;

    const loadTeacherIds = async () => {
      if (viewerRole !== 'student' || canvasType !== 'teacher_example') {
        setTeacherSessionIds(null);
        return;
      }
      try {
        setTeacherSessionsLoading(true);
        const ids = await getTeacherExampleSessionIds(lessonId, slotIndex);
        if (!cancelled) setTeacherSessionIds(ids.length ? ids : null);
      } catch (e: any) {
        if (!cancelled) {
          console.warn('[CanvasSlot] getTeacherExampleSessionIds failed:', e?.message || e);
          setTeacherSessionIds(null);
        }
      } finally {
        if (!cancelled) setTeacherSessionsLoading(false);
      }
    };

    loadTeacherIds();
    return () => { cancelled = true; };
  }, [viewerRole, canvasType, lessonId, slotIndex]);
  // New End

  // -------- UI states --------
  if (loading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Preparing Canvas…</div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600 py-2">Canvas failed to load: {errMsg}</div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }

  // Teacher review carousel (unchanged)
  if (view.kind !== 'single') {
    return (
      <div className={className}>
        <StudentCanvasCarousel sessions={view.sessions} />
      </div>
    );
  }

  // --- Single-session case ---------------------------------------------------
  const sessionId = view.session?.id;
  const sessionOwnerId = view.session?.user_id;
  const sessionType = (view.session as any)?.canvas_type as CanvasType | undefined;

  const isTeacherExampleView =
    canvasType === 'teacher_example' || sessionType === 'teacher_example';

  // Enforce read-only if student looking at teacher_example
  const enforcedReadOnly =
    view.readOnly || (viewerRole === 'student' && isTeacherExampleView);

  // Defensive logging if something unexpected slips through
  if (viewerRole === 'student' && isTeacherExampleView && sessionOwnerId === viewerUserId) {
    console.warn(
      '[CanvasSlot] Student received own session for teacher_example. Refusing to allow edits.'
    );
  }

  // Old Start: student@teacher_example → snapshot-only (final image)
  /*
  if (viewerRole === 'student' && isTeacherExampleView) {
    if (teacherSessionsLoading) {
      return (
        <div className={className}>
          <div className="text-sm text-gray-500 py-2">Loading teacher board…</div>
        </div>
      );
    }

    if (teacherSessionIds && teacherSessionIds.length) {
      return (
        <CanvasPlayback
          sessionIds={teacherSessionIds}
          snapshot
          className={`${className || ''} pointer-events-none`}
        />
      );
    }

    if (sessionId) {
      return (
        <CanvasPlayback
          sessionIds={[sessionId]}
          snapshot
          className={`${className || ''} pointer-events-none`}
        />
      );
    }

    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }
  */
  // Old End

  // New Start: student@teacher_example → merged order-based playback (full image initially, with steps/sec control)
  if (viewerRole === 'student' && isTeacherExampleView) {
    if (teacherSessionsLoading) {
      return (
        <div className={className}>
          <div className="text-sm text-gray-500 py-2">Loading teacher board…</div>
        </div>
      );
    }

    // Prefer merged playback from all teacher sessions
    if (teacherSessionIds && teacherSessionIds.length) {
      return (
        <CanvasPlayback
          sessionIds={teacherSessionIds}
          initialFull
          stepsPerSecond={40}
          className={className}
        />
      );
    }

    // Fallback: playback from the resolver's single teacher session
    if (sessionId) {
      return (
        <CanvasPlayback
          sessionIds={[sessionId]}
          initialFull
          stepsPerSecond={40}
          className={className}
        />
      );
    }

    // Nothing to show
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }
  // New End

  // Default: single-session render (teacher @ teacher_example RW, student @ student RW)
  return (
    <div className={className}>
      <CanvasWorkspace sessionId={sessionId} isReadOnly={!!enforcedReadOnly} />
    </div>
  );
};

export default CanvasSlot;
