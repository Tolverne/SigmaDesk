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

  // New Start: store *all* teacher-example sessions for student view overlay
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

        // Prevent accidental creation of a *new student session* when a student views a teacher_example board.
        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,       // 'student' | 'teacher_example'
          viewerUserId: uid,
          viewerRole,       // 'student' | 'teacher'
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

  // New Start: If a *student* is viewing a *teacher_example* slot,
  // gather *all* teacher sessions for this lesson+slot so we can overlay them read-only.
  useEffect(() => {
    let cancelled = false;

    const fetchAllTeacherSessions = async () => {
      // Only for student viewing teacher_example
      if (viewerRole !== 'student' || canvasType !== 'teacher_example') {
        setTeacherSessionIds(null);
        return;
      }

      try {
        setTeacherSessionsLoading(true);
        // Read all teacher_example sessions for this lesson/slot
        const { data, error } = await supabase
          .from('canvas_sessions')
          .select('id, canvas_type, lesson_id, slot_index, user_id, updated_at')
          .eq('lesson_id', lessonId)
          .eq('slot_index', slotIndex)
          .eq('canvas_type', 'teacher_example')
          .order('updated_at', { ascending: true });

        if (cancelled) return;

        if (error) {
          console.warn('[CanvasSlot] Fetch teacher sessions failed:', error.message);
          setTeacherSessionIds(null);
          return;
        }

        const ids = (data || []).map((s: any) => s.id as string);
        setTeacherSessionIds(ids.length ? ids : null);
      } finally {
        if (!cancelled) setTeacherSessionsLoading(false);
      }
    };

    fetchAllTeacherSessions();
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

  // New Start: Student @ teacher_example → overlay *all* teacher sessions read-only
  if (viewerRole === 'student' && isTeacherExampleView) {
    // If we’re still loading the teacher session list, show a light placeholder
    if (teacherSessionsLoading) {
      return (
        <div className={className}>
          <div className="text-sm text-gray-500 py-2">Loading teacher board…</div>
        </div>
      );
    }

    // If we found multiple teacher sessions, overlay them (union of strokes)
    if (teacherSessionIds && teacherSessionIds.length) {
      return (
        <div className={`${className || ''} relative pointer-events-none`}>
          {teacherSessionIds.map((id, idx) => (
            <div key={id} className={idx === 0 ? '' : 'absolute inset-0'}>
              <CanvasWorkspace sessionId={id} isReadOnly={true} />
            </div>
          ))}
        </div>
      );
    }

    // Fallback: if none found (odd), fall back to the resolver’s single-session (still read-only)
    return (
      <div className={`${className || ''} pointer-events-none`}>
        <CanvasWorkspace sessionId={sessionId} isReadOnly={true} />
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
