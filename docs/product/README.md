# Product Workflow Documentation

Last verified: 2026-09-09.

These documents describe the tutor-facing jobs that cross multiple entities.
They own user vocabulary, progressive disclosure, success/empty/error states,
and acceptance criteria. Domain invariants remain authoritative in
[`../domain/`](../domain/README.md).

## Pilot-critical workflows

| Workflow                          | Current assessment                                                                           | Target document                   |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------- |
| Sign in and create a workspace    | Functional; presentation is inconsistent with the approved shadcn baseline                   | [Authentication workflow](./authentication.md) |
| Create and onboard a student      | Functional but overloaded; nested parent creation and deletion semantics are unsafe          | [Student workflow](./students.md) |
| Sell and operate a lesson package | Functional but combines plan, schedule, and payment; financial invariants need stabilization | [Package workflow](./packages.md) |

## Workflow documentation template

Every new workflow document must include:

1. User and job-to-be-done.
2. Entry points and preconditions.
3. Current behavior with code and visual evidence.
4. Target happy path and progressive disclosure.
5. Validation, permissions, and domain side effects.
6. Loading, empty, error, success, and destructive states.
7. Accessibility and responsive expectations.
8. Measurable acceptance criteria and implementation slices.

## UX priority rule

Correctness precedes redesign. When a flow has unsafe domain semantics, first
encode the expected behavior in tests and fix the service. Then simplify the UI
against a stable contract. Do not polish a destructive or misleading action.
