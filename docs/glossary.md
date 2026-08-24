# Tutorio Product Glossary

Last verified: 2026-08-24.

Use these terms consistently in documentation, code concepts, API descriptions,
and localized UI meaning. UI copy may use simpler tutor-facing terms where noted.

| Term                | Meaning                                                                               | UI guidance                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Workspace           | Tenant containing one tutor/school’s records and settings                             | Usually the school or tutor name, not “workspace” in primary flows                               |
| Workspace member    | Login identity authorized in a workspace                                              | “Owner” or future “Staff”; do not confuse with teacher profile                                   |
| Teacher             | Teaching profile used for assignment                                                  | A profile does not imply login permission                                                        |
| Student             | Learner receiving lessons                                                             | “Student”                                                                                        |
| Parent              | Guardian/contact reusable across students                                             | “Parent or guardian” where appropriate                                                           |
| Group               | Teaching cohort                                                                       | “Group”                                                                                          |
| Enrollment          | Operational relationship between student, teacher, and optionally group               | Avoid the term in primary UI; use “individual study,” “group member,” or context-specific action |
| Lesson series       | Recurring scheduling rule                                                             | “Recurring schedule” or “schedule pattern”                                                       |
| Lesson              | Concrete dated occurrence                                                             | “Lesson”                                                                                         |
| Lesson package      | Commercial agreement and lesson entitlement snapshot                                  | “Lesson pack” or “lesson plan”; validate localized wording with pilot users                      |
| Fixed-count package | Plan containing a fixed number of lessons                                             | “Pack of N lessons”                                                                              |
| Period package      | Plan covering a date range/monthly period                                             | “Monthly/date-range plan”; advanced until semantics are proven                                   |
| Credit              | One lesson entitlement unit, not money                                                | Prefer “lesson” or “lessons remaining” outside activity history                                  |
| Credit entry        | Append-only change to lesson entitlement                                              | “Activity history” with a human explanation                                                      |
| Payment             | Append-only money event                                                               | “Payment” or “Received”                                                                          |
| Participant share   | Purchase-time allocation of a group plan’s amount to one enrollment                   | Explain the person’s amount; avoid the entity name in UI                                         |
| Plan total          | Agreed package amount after explicit money adjustments                                | Do not derive from zero-delta lesson events                                                      |
| Outstanding         | Plan total minus settled received money                                               | “Outstanding” or localized plain-language equivalent                                             |
| Archive             | Reversible removal from active operations while retaining history                     | Normal removal action                                                                            |
| Hard delete         | Irreversible physical removal permitted only for unused data                          | Owner-only; not a routine UI action                                                              |
| Privacy workflow    | Export plus controlled deletion/anonymization                                         | Separate from entity CRUD                                                                        |
| Effective status    | Status used consistently for commands, filters, and display after time/business rules | Never expose contradictory stored/display states                                                 |
| Materialization     | Creating concrete lessons from a recurring series                                     | Internal term; UI says “generate/schedule lessons” only when needed                              |

When a new concept is introduced, add it here before using multiple competing
labels across features.
