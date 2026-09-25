import { describe, expect, it } from 'vitest';
import {
  TEACHER_SUBJECTS_MAX,
  archiveTeacherSchema,
  createTeacherSchema,
  listTeachersQuerySchema,
  updateTeacherSchema,
} from './teachers';

describe('teacher contract', () => {
  it('trims subjects and drops a repeat that differs only in case', () => {
    const dto = createTeacherSchema.parse({
      fullName: 'Iryna',
      subjects: [' English ', 'Kids', 'english'],
    });
    expect(dto.subjects).toEqual(['English', 'Kids']);
  });

  it('refuses an empty subject and too many subjects', () => {
    expect(updateTeacherSchema.safeParse({ subjects: ['  '] }).success).toBe(false);
    const many = Array.from({ length: TEACHER_SUBJECTS_MAX + 1 }, (_, i) => `S${i}`);
    expect(updateTeacherSchema.safeParse({ subjects: many }).success).toBe(false);
  });

  it('sorts the list by name unless asked otherwise', () => {
    expect(listTeachersQuerySchema.parse({}).sort).toBe('name');
    expect(listTeachersQuerySchema.parse({ sort: 'workload' }).sort).toBe('workload');
    expect(listTeachersQuerySchema.safeParse({ sort: 'rate' }).success).toBe(false);
  });

  it('archives with or without someone to hand over to', () => {
    expect(archiveTeacherSchema.parse({})).toEqual({});
    expect(archiveTeacherSchema.parse({ transferTo: null })).toEqual({ transferTo: null });
    expect(archiveTeacherSchema.safeParse({ transferTo: 'someone' }).success).toBe(false);
  });
});
