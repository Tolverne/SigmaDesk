// src/components/canvas/CanvasSlot.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasSession, CanvasType } from '../../types/canvas.types';
import { resolveCanvasViewForUser, ViewerRole, ResolvedCanvasView } from '../../services/canvasService';
import CanvasWorkspace from './CanvasWorkspace';
import StudentCanvasCarousel from './StudentCanvasCarousel';
import { supabase } from '../../utils/supabase';

type Props = {
  lessonId: string;
  slotIndex: number;
  canvasType: CanvasType; // 'student' | 'teacher_example'
  className?: string;
  /** Optional explicit role override; if not provided we will resolve it */
  viewerRole?: ViewerRole;
};

const CanvasSlot: React.FC<Props> = ({ lessonId, slotIndex, canvasType, className, viewerRole }) => {
  const { user } = useAuth();

  const [view, setView] = useState<ResolvedCanvasView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvedRole, setResolvedRole] = useState<ViewerRole>(viewerRole ?? 'student');

  // Resolve the viewer role if not passed via props
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (viewerRole) {
        setResolvedRole(viewerRole);
        return;
      }
      // Try user metadata first
      const metaRole =
        (user?.user_metadata as any)?.role ||
        (user?.app_metadata as any)?.role ||
        (user as any)?.role;

      if (metaRole === 'teacher' || metaRole === 'student') {
        if (!cancelled) setResolvedRole(metaRole);
        return;
      }

      // Fallback: check user_profiles table
      if (user?.id) {
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          const dbRole = (data?.role === 'teacher' || data?.role === 'student') ? data.role : 'student';
          if (!cancelled) setResolvedRole(dbRole);
        } catch {
          if (!cancelled) setResolvedRole('student');
        }
      } else {
        if (!cancelled) setResolvedRole('student');
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, viewerRole]);

  // Resolve what to render for this slot (single canvas or carousel)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) {
        // Unauthenticated -> behave like a student viewing teacher board read-only
        // but resolver needs a viewerUserId; use a dummy and student role
        try {
          setLoading(true);
          // Old Start: calling resolve without viewerRole (missing param)
          // const v = await resolveCanvasViewForUser({ lessonId, slotIndex, canvasType, viewerUserId: 'anon' });
          // Old End
          // New Start: include viewerRole explicitly (fixes TS error)
          const v = await resolveCanvasViewForUser({
            lessonId,
            slotIndex,
            canvasType,
            viewerUserId: 'anon',
            viewerRole: 'student',
          });
          // New End
          if (!cancelled) setView(v);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        // Old Start: missing viewerRole in call
        // const v = await resolveCanvasViewForUser({
        //   lessonId,
        //   slotIndex,
        //   canvasType,
        //   viewerUserId: user.id,
        // });
        // Old End
        // New Start: pass resolvedRole to satisfy the signature and logic
        const v = await resolveCanvasViewForUser({
          lessonId,
          slotIndex,
          canvasType,
          viewerUserId: user.id,
          viewerRole: resolvedRole,
        });
        // New End
        if (!cancelled) setView(v);
      } catch (e) {
        console.error('CanvasSlot resolve failed:', e);
        if (!cancelled) setView(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, lessonId, slotIndex, canvasType, resolvedRole]);

  if (loading) {
    return (
      <div className={className}>
        <div className="h-10 flex items-center text-gray-500 text-sm">Loading canvas…</div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className={className}>
        <div className="text-gray-500 text-sm">Nothing to show yet.</div>
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

  // kind === 'carousel'
  return (
    <div className={className}>
      <StudentCanvasCarousel sessions={view.sessions} />
    </div>
  );
};

export default CanvasSlot;
