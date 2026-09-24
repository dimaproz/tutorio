import { describe, expect, it } from 'vitest';
import type { AuditLogResponse } from '@tutorio/validation';
import { cancellationActor, lessonHistory } from './history';
import { lessonFixture } from './testing';

let sequence = 0;
function entry(
  createdAt: string,
  fields: Record<string, { before: unknown; after: unknown }> | null,
  action: AuditLogResponse['action'] = 'UPDATE',
  actor: string | null = 'Olena Kovalenko',
): AuditLogResponse {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    actorId: actor ? '66666666-6666-4666-8666-666666666666' : null,
    actor: actor
      ? { id: '66666666-6666-4666-8666-666666666666', name: actor, email: 'o@x.test' }
      : null,
    entity: 'LESSON',
    entityId: '88888888-8888-4888-8888-000000000001',
    action,
    changes: fields ? { fields } : null,
    createdAt,
  };
}

describe('lesson history', () => {
  it('folds the charge of a status change into it and adds the creation of a schedule lesson', () => {
    const history = [
      entry('2026-09-11T11:05:00.500Z', {
        status: { before: 'SCHEDULED', after: 'CANCELLED_CHARGED' },
        cancelledBy: { before: null, after: 'STUDENT' },
        cancelledReason: { before: null, after: 'Захворіла' },
      }),
      entry('2026-09-11T11:05:00.200Z', { 'charge.e1': { before: null, after: 'PACKAGE' } }),
      entry('2026-09-09T07:12:00.000Z', {
        topic: { before: 'Present Perfect', after: 'Past Perfect' },
      }),
    ];
    const events = lessonHistory(lessonFixture({ history, seriesId: 's1' }));

    expect(events.map((event) => event.kind)).toEqual(['status', 'topic', 'created']);
    expect(events[0]).toMatchObject({
      kind: 'status',
      to: 'CANCELLED_CHARGED',
      cancelledBy: 'STUDENT',
      reason: 'Захворіла',
      charged: 1,
      automatic: false,
    });
    expect(events[1]).toMatchObject({ before: 'Present Perfect', after: 'Past Perfect' });
    expect(events[2]).toMatchObject({ source: 'schedule', at: '2026-08-25T08:03:00.000Z' });
    expect(cancellationActor(events)).toBe('Olena Kovalenko');
  });

  it('reads the end-of-lesson automation as automatic', () => {
    const events = lessonHistory(
      lessonFixture({
        history: [
          entry(
            '2026-09-04T15:00:00.000Z',
            {
              status: { before: 'SCHEDULED', after: 'COMPLETED' },
              completedBy: { before: null, after: 'SCHEDULE' },
            },
            'UPDATE',
            null,
          ),
        ],
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'status', to: 'COMPLETED', automatic: true });
  });

  it('splits one edit into its changes and counts attendance marks', () => {
    const events = lessonHistory(
      lessonFixture({
        history: [
          entry('2026-09-15T16:45:00.000Z', {
            'attendance.a': { before: null, after: 'PRESENT' },
            'attendance.b': { before: null, after: 'ABSENT' },
            'attendance.c': { before: 'PRESENT', after: 'EXCUSED' },
          }),
          entry('2026-09-03T09:00:00.000Z', {
            priceMinor: { before: 45000, after: 50000 },
            teacherId: { before: 't1', after: 't2' },
          }),
          entry(
            '2026-08-20T09:00:00.000Z',
            { originalLessonId: { before: null, after: 'o1' } },
            'CREATE',
          ),
        ],
      }),
    );
    expect(events.map((event) => event.kind)).toEqual([
      'attendance',
      'teacher',
      'price',
      'created',
    ]);
    expect(events[0]).toMatchObject({ marks: { PRESENT: 1, ABSENT: 1, EXCUSED: 1 } });
    expect(events[2]).toMatchObject({ before: 45000, after: 50000 });
    expect(events[3]).toMatchObject({ source: 'makeup' });
  });

  it('keeps a charge that happened on its own', () => {
    const events = lessonHistory(
      lessonFixture({
        history: [
          entry('2026-09-10T09:00:00.000Z', { 'charge.e1': { before: 'DEBT', after: null } }),
        ],
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'charge', charged: 0, released: 1 });
  });
});
