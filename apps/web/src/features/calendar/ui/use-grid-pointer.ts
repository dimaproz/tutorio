'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { snapMinutes, SNAP_MIN, type CalendarLesson } from '../model/lessons';

/** How far a mouse moves before a press becomes a drag. */
const MOUSE_SLOP = 4;
/** A finger that moves this far before the long press is a scroll. */
const TOUCH_SLOP = 8;
/** How long a finger holds a lesson before it lifts (decision 8). */
const LONG_PRESS_MS = 350;

export type GridDrag = { lesson: CalendarLesson; dayIndex: number; startMin: number };
export type GridSelection = { dayIndex: number; startMin: number; endMin: number };

type Press =
  | {
      kind: 'lesson';
      lesson: CalendarLesson;
      pointerType: string;
      x: number;
      y: number;
      grabMin: number;
      active: boolean;
      timer: number | null;
    }
  | {
      kind: 'slot';
      dayIndex: number;
      originMin: number;
      pointerType: string;
      x: number;
      y: number;
      moved: boolean;
    };

/**
 * The time grid's pointer work: dragging a lesson (a mouse after a few
 * pixels, a finger after a long press) snapped to 15 minutes, with Esc to
 * cancel; and marking empty time by a click or a drag. The grid owns the
 * column elements and the hour height; this returns what to draw.
 */
export function useGridPointer({
  hourHeight,
  enabled,
  onMove,
  onSelect,
}: {
  hourHeight: number;
  enabled: boolean;
  onMove: (lesson: CalendarLesson, dayIndex: number, startMin: number) => void;
  onSelect: (selection: GridSelection, dragged: boolean) => void;
}) {
  const columns = useRef<(HTMLElement | null)[]>([]);
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDragState] = useState<GridDrag | null>(null);
  const [selection, setSelectionState] = useState<GridSelection | null>(null);
  // The last drawn drop and selection, read when the pointer lifts.
  const dragRef = useRef<GridDrag | null>(null);
  const selectionRef = useRef<GridSelection | null>(null);
  const setDrag = useCallback((next: GridDrag | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);
  const setSelection = useCallback((next: GridSelection | null) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);
  const handlers = useRef<{ move: (event: globalThis.PointerEvent) => void } | null>(null);

  const locate = useCallback(
    (x: number, y: number) => {
      const cells = columns.current.filter((cell): cell is HTMLElement => cell !== null);
      if (cells.length === 0) return null;
      let dayIndex = cells.findIndex((cell) => {
        const rect = cell.getBoundingClientRect();
        return x >= rect.left && x < rect.right;
      });
      if (dayIndex === -1) {
        dayIndex = x < cells[0]!.getBoundingClientRect().left ? 0 : cells.length - 1;
      }
      const rect = cells[dayIndex]!.getBoundingClientRect();
      return { dayIndex, minutes: ((y - rect.top) / hourHeight) * 60 };
    },
    [hourHeight],
  );

  const end = useCallback(() => {
    const current = press.current;
    if (current?.kind === 'lesson' && current.timer !== null) window.clearTimeout(current.timer);
    press.current = null;
    setDrag(null);
    setSelection(null);
    if (handlers.current) {
      window.removeEventListener('pointermove', handlers.current.move);
      handlers.current = null;
    }
  }, [setDrag, setSelection]);

  useEffect(() => end, [end]);

  const listen = useCallback(
    (onUp: (event: globalThis.PointerEvent) => void) => {
      const move = (event: globalThis.PointerEvent) => {
        const current = press.current;
        if (!current) return;
        const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y);
        const location = locate(event.clientX, event.clientY);
        if (!location) return;
        if (current.kind === 'lesson') {
          if (!current.active) {
            if (current.pointerType === 'touch') {
              // A finger that moves first is scrolling, not dragging.
              if (distance > TOUCH_SLOP) end();
              return;
            }
            if (distance <= MOUSE_SLOP) return;
            current.active = true;
          }
          event.preventDefault();
          setDrag({
            lesson: current.lesson,
            dayIndex: location.dayIndex,
            startMin: snapMinutes(location.minutes - current.grabMin),
          });
          return;
        }
        if (current.pointerType === 'touch') return;
        if (distance > MOUSE_SLOP) current.moved = true;
        const reach = Math.ceil(location.minutes / SNAP_MIN) * SNAP_MIN;
        setSelection({
          dayIndex: current.dayIndex,
          startMin: Math.min(current.originMin, reach - SNAP_MIN),
          endMin: Math.max(current.originMin + SNAP_MIN, reach),
        });
      };
      const up = (event: globalThis.PointerEvent) => {
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', escape);
        window.removeEventListener('touchmove', holdTouch);
        onUp(event);
        end();
      };
      const cancel = () => {
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', escape);
        window.removeEventListener('touchmove', holdTouch);
        end();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (press.current?.kind === 'lesson' && press.current.active) suppressClick.current = true;
        cancel();
      };
      // Once a finger has lifted a lesson, its moves drag instead of scrolling.
      const holdTouch = (event: TouchEvent) => {
        if (press.current?.kind === 'lesson' && press.current.active) event.preventDefault();
      };
      handlers.current = { move };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', escape);
      window.addEventListener('touchmove', holdTouch, { passive: false });
    },
    [end, locate, setDrag, setSelection],
  );

  const lessonPointerDown = (
    event: PointerEvent<HTMLElement>,
    lesson: CalendarLesson,
    startMin: number,
    movable: boolean,
  ) => {
    if (!enabled || !movable || event.button !== 0) return;
    const location = locate(event.clientX, event.clientY);
    if (!location) return;
    const current: Press = {
      kind: 'lesson',
      lesson,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      grabMin: location.minutes - startMin,
      active: false,
      timer: null,
    };
    if (event.pointerType === 'touch') {
      current.timer = window.setTimeout(() => {
        if (press.current !== current) return;
        current.active = true;
        setDrag({ lesson, dayIndex: location.dayIndex, startMin });
      }, LONG_PRESS_MS);
    }
    press.current = current;
    listen(() => {
      if (!current.active) return;
      suppressClick.current = true;
      const last = dragRef.current;
      if (last) onMove(last.lesson, last.dayIndex, last.startMin);
    });
  };

  const slotPointerDown = (event: PointerEvent<HTMLElement>, dayIndex: number) => {
    if (!enabled || event.button !== 0 || event.target !== event.currentTarget) return;
    const location = locate(event.clientX, event.clientY);
    if (!location) return;
    const originMin = Math.min(1440 - SNAP_MIN, Math.floor(location.minutes / SNAP_MIN) * SNAP_MIN);
    const current: Press = {
      kind: 'slot',
      dayIndex,
      originMin,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    press.current = current;
    setSelection({ dayIndex, startMin: originMin, endMin: originMin + SNAP_MIN });
    listen(() => {
      const last = selectionRef.current;
      if (!last) return;
      onSelect(
        current.moved ? last : { dayIndex, startMin: originMin, endMin: originMin + 60 },
        current.moved,
      );
    });
  };

  /** A click that ended a drag is not a click. */
  const takeClick = () => {
    if (!suppressClick.current) return true;
    suppressClick.current = false;
    return false;
  };

  return { columns, drag, selection, lessonPointerDown, slotPointerDown, takeClick };
}
