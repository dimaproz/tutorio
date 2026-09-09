# Architecture Decision Records

ADRs capture durable product and engineering choices. They describe the target
contract even when implementation is still pending. A code path is not compliant
until its tests and behavior match the accepted decision.

| ADR                                                   | Decision                                                        | Status                                  |
| ----------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| [0001](./0001-pilot-first-delivery.md)                | Pilot-first delivery and constrained design investment          | Accepted; implementation in progress    |
| [0002](./0002-record-lifecycle-and-deletion.md)       | Archive-first lifecycle and history-preserving privacy handling | Accepted target; implementation differs |
| [0003](./0003-cancellation-and-package-accounting.md) | One compensation per cancellation; no implicit money discount   | Accepted target; implementation differs |
| [0004](./0004-owner-operated-pilot.md)                | Owner-operated pilot until staff authorization is complete      | Accepted target; enforcement incomplete |
| [0005](./0005-shadcn-frontend-foundation.md)          | Official shadcn baseline, Storybook, and screen briefs           | Accepted; implementation in progress    |

## ADR lifecycle

- `Proposed`: under discussion and not safe to implement as a dependency.
- `Accepted`: target contract for new work.
- `Superseded`: replaced by a linked ADR.
- `Rejected`: considered but not adopted.

Never edit an accepted ADR to reverse its decision. Add a new ADR and mark the
old one superseded.
