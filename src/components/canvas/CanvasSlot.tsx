/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasType } from '../../types/canvas.types';
import {
  resolveCanvasViewForUser,
  ViewerRole,
  ResolvedCanvasView,
  getTeacherExampleSessionIds,
} from '../../services/canvasService';
import CanvasViewer from './CanvasViewer';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import { supabase } from '../../utils/supabase';

type CanvasSlotProps = {
  className?: string;
  lessonId: string;
  slotIndex: number;
  canvasType: CanvasType;
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
  const [viewerRole, setViewerRole] = useState<ViewerRole>('student');
  
  const [teacherSessionIds, setTeacherSessionIds] = useState<string[] | null>(null);
  const [teacherSessionsLoading, setTeacherSessionsLoading] = useState<boolean>(false);

  // Resolve user role
  useEffect(() => {
    let cancelled = false;

    const resolveRole = async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        if (!viewerUserId) {
          console.warn('[CanvasSlot] No user session, defaulting to student role');
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
          console.warn('[CanvasSlot] Role fetch failed, defaulting to student:', error.message);
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

  // Resolve what to render
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        if (!lessonId || slotIndex == null) {
          setErrMsg('Invalid canvas slot');
          return;
        }

        const uid = viewerUserId || 'anonymous';

        console.log('[CanvasSlot] Resolving view:', {
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: uid,
          viewerRole,
        });

        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: uid,
          viewerRole,
          createIfMissing: !(viewerRole === 'student' && canvasType === 'teacher_example'),
        } as any);

        if (cancelled) return;

        if (!v) {
          console.log('[CanvasSlot] No resolved view');
          setView(null);
          return;
        }

        setView(v);
      } catch (e: any) {
        console.error('[CanvasSlot] Resolve failed:', e);
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

  // For student@teacher_example, fetch ALL teacher session IDs
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
    return () => {
      cancelled = true;
    };
  }, [viewerRole, canvasType, lessonId, slotIndex]);

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Preparing Canvas…</div>
      </div>
    );
  }

  // Error state
  if (errMsg) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600 py-2">Canvas failed to load: {errMsg}</div>
      </div>
    );
  }

  // No view
  if (!view) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }

  // Teacher reviewing students (carousel)
  if (view.kind !== 'single') {
    return (
      <div className={className}>
        <StudentCanvasCarousel sessions={view.sessions} />
      </div>
    );
  }

  // Single session cases
  const sessionId = view.session?.id;
  const sessionType = (view.session as any)?.canvas_type as CanvasType | undefined;
  const isTeacherExampleView = canvasType === 'teacher_example' || sessionType === 'teacher_example';
  const enforcedReadOnly = view.readOnly || (viewerRole === 'student' && isTeacherExampleView);

  // Student viewing teacher example (merged playback)
  if (viewerRole === 'student' && isTeacherExampleView) {
    if (teacherSessionsLoading) {
      return (
        <div className={className}>
          <div className="text-sm text-gray-500 py-2">Loading teacher board…</div>
        </div>
      );
    }

    // Merged playback from all teacher sessions
    if (teacherSessionIds && teacherSessionIds.length) {
      return (
        <CanvasViewer
          sessionIds={teacherSessionIds}
          isReadOnly={true}
          showModeToggle={true}
          defaultMode="playback"
          className={className}
        />
      );
    }

    // Fallback: single teacher session
    if (sessionId) {
      return (
        <CanvasViewer
          sessionId={sessionId}
          isReadOnly={true}
          showModeToggle={true}
          defaultMode="playback"
          className={className}
        />
      );
    }

    return (
      <div className={className}>
        <div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div>
      </div>
    );
  }

  // Default: single session with mode toggle
  return (
    <div className={className}>
      <CanvasViewer
        sessionId={sessionId}
        isReadOnly={!!enforcedReadOnly}
        showModeToggle={true}
        defaultMode="draw"
      />
    </div>
  );
};

export default CanvasSlot;