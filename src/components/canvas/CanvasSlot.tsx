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
import CanvasWorkspace from './CanvasWorkspace';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import CanvasPlayback from './CanvasPlayback';
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
  const viewerUserId = user?.id || '';

  // Role
  const [viewerRole, setViewerRole] = useState<ViewerRole>('student');
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  // View
  const [view, setView] = useState<ResolvedCanvasView | null>(null);
  const [viewLoading, setViewLoading] = useState<boolean>(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Teacher sessions (for student@teacher_example)
  const [teacherSessionIds, setTeacherSessionIds] = useState<string[] | null>(null);
  const [teacherIdsLoading, setTeacherIdsLoading] = useState<boolean>(false);

  // (Optional) course id (used by the carousel if present; the carousel can also resolve it)
  const [courseId, setCourseId] = useState<string | null>(null);

  // 1) Resolve viewer role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRoleLoading(true);
        if (!viewerUserId) {
          setViewerRole('student');
          return;
        }
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', viewerUserId)
          .maybeSingle();
        if (cancelled) return;
        if (error) setViewerRole('student');
        else setViewerRole(roleFromString(data?.role));
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewerUserId]);

  // 2) Resolve what to render (single vs carousel)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setViewLoading(true);
        setErrMsg(null);

        const uid = viewerUserId || 'anonymous';
        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: uid,
          viewerRole,
        } as any);

        if (cancelled) return;
        setView(v || null);
      } catch (e: any) {
        if (!cancelled) {
          console.error('[CanvasSlot] resolve failed:', e);
          setErrMsg(e?.message || 'Failed to prepare canvas');
        }
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, slotIndex, canvasType, viewerUserId, viewerRole]);

  // 3) Optional: resolve course for this lesson (via topics). Carousel can also do this itself.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('topic_id, topics ( course_id )')
          .eq('id', lessonId)
          .maybeSingle();
        if (!cancelled) {
          if (error) setCourseId(null);
          else setCourseId((data as any)?.topics?.course_id ?? null);
        }
      } catch {
        if (!cancelled) setCourseId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  // 4) Teacher sessions for student@teacher_example
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(viewerRole === 'student' && canvasType === 'teacher_example')) {
        setTeacherSessionIds(null);
        return;
      }
      try {
        setTeacherIdsLoading(true);
        const ids = await getTeacherExampleSessionIds(lessonId, slotIndex);
        if (!cancelled) setTeacherSessionIds(ids.length ? ids : null);
      } catch (e: any) {
        if (!cancelled) {
          console.warn('[CanvasSlot] getTeacherExampleSessionIds failed:', e?.message || e);
          setTeacherSessionIds(null);
        }
      } finally {
        if (!cancelled) setTeacherIdsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewerRole, canvasType, lessonId, slotIndex]);

  // -------- UI states --------
  if (roleLoading || viewLoading) {
    return <div className={className}><div className="text-sm text-gray-500 py-2">Preparing Canvas…</div></div>;
  }
  if (errMsg) {
    return <div className={className}><div className="text-sm text-red-600 py-2">Canvas failed to load: {errMsg}</div></div>;
  }
  if (!view) {
    return <div className={className}><div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div></div>;
  }

  // Teacher review → carousel
  if (view.kind !== 'single') {
    return (
      <div className={className}>
        <StudentCanvasCarousel
          sessions={view.sessions}
          lessonId={lessonId}
          slotIndex={slotIndex}
          courseId={courseId ?? undefined}
        />
      </div>
    );
  }

  // Single-session case
  const sessionId = view.session?.id;
  const sessionType = (view.session as any)?.canvas_type as CanvasType | undefined;

  const isTeacherExampleView =
    canvasType === 'teacher_example' || sessionType === 'teacher_example';

  const enforcedReadOnly =
    view.readOnly || (viewerRole === 'student' && isTeacherExampleView);

  if (viewerRole === 'student' && isTeacherExampleView) {
    if (teacherIdsLoading) {
      return <div className={className}><div className="text-sm text-gray-500 py-2">Loading teacher board…</div></div>;
    }
    if (teacherSessionIds && teacherSessionIds.length) {
      return <CanvasPlayback sessionIds={teacherSessionIds} className={`${className || ''} pointer-events-none`} initialFull />;
    }
    if (sessionId) {
      return <CanvasPlayback sessionIds={[sessionId]} className={`${className || ''} pointer-events-none`} initialFull />;
    }
    return <div className={className}><div className="text-sm text-gray-500 py-2">Nothing to show here yet.</div></div>;
  }

  // Default: live canvas
  return (
    <div className={className}>
      <CanvasWorkspace sessionId={sessionId!} isReadOnly={!!enforcedReadOnly} />
    </div>
  );
};

export default CanvasSlot;
