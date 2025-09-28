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

  // Resolve viewer role (prefer AuthContext if you expose it; otherwise fetch from user_profiles)
  const [viewerRole, setViewerRole] = useState<ViewerRole>('student');

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

  // Resolve what to render for this slot
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

        // Prevent accidental creation of a new session when a *student* views a teacher_example board.
        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,       // 'student' | 'teacher_example'
          viewerUserId: uid,
          viewerRole,       // 'student' | 'teacher'
          // If service ignores this, it's harmless; otherwise it enforces the intended constraint:
          createIfMissing: !(viewerRole === 'student' && canvasType === 'teacher_example'),
        } as any);

        if (cancelled) return;

        // If there’s no teacher board yet for a teacher slot and the viewer is a student,
        // resolver can return null → show a friendly message.
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

    // Only run when we know the role, to avoid double-resolve flicker
    if (viewerRole) run();

    return () => {
      cancelled = true;
    };
  }, [lessonId, slotIndex, canvasType, viewerUserId, viewerRole]);

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

  // If there’s no teacher board yet for students viewing a teacher slot
  if (!view) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }

  // Teacher review carousel (your existing behavior)
  if (view.kind !== 'single') {
    return (
      <div className={className}>
        <StudentCanvasCarousel sessions={view.sessions} />
      </div>
    );
  }

  // --- Single-session case ---------------------------------------------------
  // Enforce:
  // - Student @ teacher_example => read-only AND load the *teacher's* session.
  // - No accidental "new student session" for teacher_example.
  const sessionId = view.session?.id;
  const sessionOwnerId = view.session?.user_id;
  const sessionType = (view.session as any)?.canvas_type as CanvasType | undefined;

  const isTeacherExampleView =
    canvasType === 'teacher_example' || sessionType === 'teacher_example';

  // Force read-only if student looking at teacher_example
  const enforcedReadOnly =
    view.readOnly || (viewerRole === 'student' && isTeacherExampleView);

  // Defensive logging if something unexpected slips through
  if (viewerRole === 'student' && isTeacherExampleView && sessionOwnerId === viewerUserId) {
    console.warn(
      '[CanvasSlot] Student received own session for teacher_example. ' +
        'Refusing to allow edits.'
    );
  }

  return (
    <div className={className}>
      <CanvasWorkspace
        sessionId={sessionId}
        isReadOnly={!!enforcedReadOnly}
      />
    </div>
  );
};

export default CanvasSlot;
