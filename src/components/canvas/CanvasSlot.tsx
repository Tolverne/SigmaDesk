/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasSession, CanvasType } from '../../types/canvas.types';
import { resolveCanvasViewForUser, ViewerRole, ResolvedCanvasView } from '../../services/canvasService';
import CanvasWorkspace from './CanvasWorkspace';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import { supabase } from '../../utils/supabase';

type CanvasSlotProps = {
  className?: string;
  lessonId: string;
  slotIndex: number;
  canvasType: CanvasType; // 'student' | 'teacher' | 'teacher_example'
};

const roleFromString = (s?: string): ViewerRole => (s === 'teacher' ? 'teacher' : 'student');

const CanvasSlot: React.FC<CanvasSlotProps> = ({ className, lessonId, slotIndex, canvasType }) => {
  const { user } = useAuth();

  const [view, setView] = useState<ResolvedCanvasView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const viewerUserId = user?.id || '';

  // Resolve viewer role (prefer AuthContext if you expose it; otherwise pull from profiles)
  const [viewerRole, setViewerRole] = useState<ViewerRole>('student');

  useEffect(() => {
    let cancelled = false;

    const go = async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        if (!viewerUserId) {
          console.warn('[CanvasSlot] No user session yet → read-only context; still attempting resolve');
          // We still need a role to decide behavior; defaulting to student as a safe default:
          setViewerRole('student');
        } else {
          // Try to fetch role from user_profiles (if your AuthContext doesn’t provide it)
          const { data: prof, error } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', viewerUserId)
            .maybeSingle();

          if (error) {
            console.warn('[CanvasSlot] fetch role failed, defaulting student:', error.message);
            setViewerRole('student');
          } else {
            setViewerRole(roleFromString(prof?.role));
          }
        }
      } finally {
        // This effect only sets viewerRole; resolution happens in a separate effect below.
      }
    };

    go();
    return () => { cancelled = true; };
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

        // We require a viewerUserId to create “own” sessions.
        // If user is not present (viewerUserId empty), students/teachers won’t be able to edit anyway.
        const uid = viewerUserId || 'anonymous';

        console.log('[CanvasSlot] Resolving view →', {
          lessonId, slotIndex, canvasType, viewerUserId: uid, viewerRole,
        });

        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: uid,
          viewerRole,
        });

        if (cancelled) return;

        // If there’s no teacher board yet for a teacher slot and the viewer is a student,
        // resolver returns null → show a friendly message instead of spinner.
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

    // Only run when we have a role (otherwise we’d flip twice needlessly)
    if (viewerRole) run();

    return () => { cancelled = true; };
  }, [lessonId, slotIndex, canvasType, viewerUserId, viewerRole]);

  // UI states
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

  if (view.kind === 'single') {
    return (
      <div className={className}>
        <CanvasWorkspace sessionId={view.session.id} isReadOnly={view.readOnly} />
      </div>
    );
  }

  // Carousel of student work for teachers
  return (
    <div className={className}>
      <StudentCanvasCarousel sessions={view.sessions} />
    </div>
  );
};

export default CanvasSlot;
