# Tutorio Product Glossary

Last verified: 2026-09-23.

Use these terms consistently in documentation, code concepts, API descriptions,
and localized UI meaning. UI copy may use simpler tutor-facing terms where noted.

| Term                | Meaning                                                                                                                      | UI guidance                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Workspace           | Tenant containing one tutor/school’s records and settings                                                                    | Usually the school or tutor name, not “workspace” in primary flows                               |
| Workspace member    | Login identity authorized in a workspace                                                                                     | “Owner” or future “Staff”; do not confuse with teacher profile                                   |
| Teacher             | Teaching profile used for assignment                                                                                         | A profile does not imply login permission                                                        |
| Student             | Learner receiving lessons                                                                                                    | “Student”                                                                                        |
| Parent              | Guardian/contact reusable across students                                                                                    | “Parent or guardian” where appropriate                                                           |
| Group               | Teaching cohort                                                                                                              | “Group”                                                                                          |
| Enrollment          | Operational relationship between student, teacher, and optionally group                                                      | Avoid the term in primary UI; use “individual study,” “group member,” or context-specific action |
| Lesson series       | Recurring rule of one direction: weekdays with own times, one duration, a rolling horizon                                    | “Schedule”                                                                                       |
| Direction           | A student with one teacher, or a student's membership of one group (stored as Enrollment); carries the billing mode and rate | Never named; the UI says “with Dmytro” or “group B2”                                             |
| Horizon             | How many weeks ahead a schedule keeps lessons generated (studio default 4)                                                   | “Plan lessons N weeks ahead”                                                                     |
| Makeup              | Individual lesson given in place of a cancelled or no-show lesson, linked to it; exactly one of the pair is charged          | “Makeup lesson”                                                                                  |
| No-show             | Charged status: the student did not come without notice (individual lessons)                                                 | “No-show”                                                                                        |
| Charge              | One participant's cost for one lesson: a package credit, a balance amount, or a debt                                         | “Charged” / “Unpaid”                                                                             |
| Debt                | A charge nothing has paid for yet (no credits, or unpaid pay-per-lesson)                                                     | “Unpaid” / “Debt”                                                                                |
| Pause               | Period in which a student or one direction takes no lessons; packages are extended                                           | “On pause”                                                                                       |
| Lesson              | Concrete dated occurrence                                                                                                    | “Lesson”                                                                                         |
| Lesson package      | Commercial agreement and lesson entitlement snapshot                                                                         | “Lesson pack” or “lesson plan”; validate localized wording with pilot users                      |
| Fixed-count package | Plan containing a fixed number of lessons                                                                                    | “Pack of N lessons”                                                                              |
| Period package      | Plan covering a date range/monthly period                                                                                    | “Monthly/date-range plan”; advanced until semantics are proven                                   |
| Credit              | One lesson entitlement unit, not money                                                                                       | Prefer “lesson” or “lessons remaining” outside activity history                                  |
| Credit entry        | Append-only change to lesson entitlement                                                                                     | “Activity history” with a human explanation                                                      |
| Payment             | Append-only money event                                                                                                      | “Payment” or “Received”                                                                          |
| Participant share   | Retired (ADR 0007): a group member pays with their own package or balance                                                    | Explain the person’s amount; avoid the entity name in UI                                         |
| Plan total          | Agreed package amount after explicit money adjustments                                                                       | Do not derive from zero-delta lesson events                                                      |
| Outstanding         | Plan total minus settled received money                                                                                      | “Outstanding” or localized plain-language equivalent                                             |
| Archive             | Reversible removal from active operations while retaining history                                                            | Normal removal action                                                                            |
| Hard delete         | Irreversible physical removal permitted only for unused data                                                                 | Owner-only; not a routine UI action                                                              |
| Privacy workflow    | Export plus controlled deletion/anonymization                                                                                | Separate from entity CRUD                                                                        |
| Effective status    | Status used consistently for commands, filters, and display after time/business rules                                        | Never expose contradictory stored/display states                                                 |
| Materialization     | Creating concrete lessons from a recurring series                                                                            | Internal term; UI says “generate/schedule lessons” only when needed                              |

When a new concept is introduced, add it here before using multiple competing
labels across features.
