'use client';

import { useMemo } from 'react';
import type { GroupBillingResponse, GroupDetail } from '@tutorio/validation';
import {
  memberBillingState,
  type MemberBillingState,
  type MemberSaleCandidate,
} from '@/features/packages';

/**
 * Each member's standing (S08), keyed by membership: their billing read with
 * the roster's own word on a break (a paused membership, a student on hold).
 * Empty while the billing read is not there.
 */
export function useMemberStates(
  group: GroupDetail,
  billing: GroupBillingResponse | undefined,
  now: number,
): ReadonlyMap<string, MemberBillingState> {
  return useMemo(() => {
    const byMembership = new Map(billing?.members.map((member) => [member.enrollmentId, member]));
    const states = new Map<string, MemberBillingState>();
    for (const enrollment of group.enrollments) {
      const member = byMembership.get(enrollment.id);
      if (!member) continue;
      states.set(
        enrollment.id,
        memberBillingState(member, {
          onHold: enrollment.status === 'PAUSED' || enrollment.student.status === 'ON_HOLD',
          now,
        }),
      );
    }
    return states;
  }, [group.enrollments, billing, now]);
}

/** The members a group sale can sell to, with their own rate (L-11) and standing. */
export function saleCandidates(
  group: GroupDetail,
  states: ReadonlyMap<string, MemberBillingState>,
): MemberSaleCandidate[] {
  return group.enrollments.flatMap((enrollment) => {
    const state = states.get(enrollment.id);
    return state
      ? [
          {
            studentId: enrollment.studentId,
            fullName: enrollment.student.fullName,
            avatarKey: enrollment.student.avatarKey,
            ownRateMinor: enrollment.ownPrice ? enrollment.priceMinor : null,
            state,
          },
        ]
      : [];
  });
}
