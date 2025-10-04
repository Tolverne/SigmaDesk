/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasType } from '../../types/canvas.types';
import {
  resolveCanvasViewForUser,
  ViewerRole,
  ResolvedCanvasView,
  getClassCanvasSessionIds,
} from '../../services/canvasService';
import CanvasWorkspace from './CanvasWorkspace';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import CanvasPlayback from './CanvasPlayback';
import { supabase } from '../../utils/supabase';

type CanvasSlotProps = {
  className?: string;
  lessonId: string;
  slotIndex: number;
  canvasType: CanvasType; // 'student' | 'class'
  classId?: string; // Class context from URL (required for class canvases)
};

const roleFromString = (s?: string): ViewerRole => (s === 'teacher' ? 'teacher' : 'student');

const CanvasSlot: React.FC<CanvasSlotProps> = ({
  className,
  lessonId,
  slotIndex,
  canvasType,
  classId, // Use classId directly from prop
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

  // Class canvas sessions (for student viewing class canvas)
  const [classSessionIds, setClassSessionIds] = useState<string[] | null>(null);
  const [classIdsLoading, setClassIdsLoading] = useState<boolean>(false);

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

            // In CanvasSlot.tsx, in the useEffect that resolves the view
            console.log('[CanvasSlot DEBUG]', {
            lessonId,
            slotIndex,
            canvasType,
            viewerRole,
            classId,
            viewerUserId: uid
            });

            const v = await resolveCanvasViewForUser({
            lessonId,
            slotIndex,
            canvasType,
            viewerUserId: uid,
            viewerRole,
            classId: classId,
            });

            console.log('[CanvasSlot DEBUG] Result:', v);

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
  }, [lessonId, slotIndex, canvasType, viewerUserId, viewerRole, classId]);

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

  // 4) Class canvas sessions for student viewing class canvas
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(viewerRole === 'student' && canvasType === 'class')) {
        setClassSessionIds(null);
        return;
      }
      try {
        setClassIdsLoading(true);
        const ids = await getClassCanvasSessionIds(lessonId, slotIndex, classId ?? undefined);
        if (!cancelled) setClassSessionIds(ids.length ? ids : null);
      } catch (e: any) {
        if (!cancelled) {
          console.warn('[CanvasSlot] getClassCanvasSessionIds failed:', e?.message || e);
          setClassSessionIds(null);
        }
      } finally {
        if (!cancelled) setClassIdsLoading(false);
      }
    })();
  }, [viewerRole, canvasType, lessonId, slotIndex, classId]);

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

  const isClassCanvasView =
    canvasType === 'class' || sessionType === 'class';

  const enforcedReadOnly =
    view.readOnly || (viewerRole === 'student' && isClassCanvasView);

if (viewerRole === 'student' && isClassCanvasView) {
  console.log('[CanvasSlot] Student viewing class canvas', {
    classIdsLoading,
    classSessionIds,
    sessionId,
    hasClassSessionIds: !!(classSessionIds && classSessionIds.length)
  });

  if (classIdsLoading) {
    return <div className={className}><div className="text-sm text-gray-500 py-2">Loading class board…</div></div>;
  }
if (classSessionIds && classSessionIds.length) {
  console.log('[CanvasSlot] Rendering CanvasPlayback with classSessionIds:', classSessionIds);
  // REMOVED pointer-events-none - playback controls need to be clickable
  return <CanvasPlayback sessionIds={classSessionIds} className={className} initialFull />;
}
if (sessionId) {
  console.log('[CanvasSlot] Rendering CanvasPlayback with single sessionId:', sessionId);
  // REMOVED pointer-events-none
  return <CanvasPlayback sessionIds={[sessionId]} className={className} initialFull />;
}
  console.log('[CanvasSlot] Falling through to "Nothing to show"');
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