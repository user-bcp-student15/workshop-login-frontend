import { describe, expect, it } from 'vitest';
import { formatTaskLabel, prepareTasks } from './legacy-format';

describe('formatTaskLabel', () => {
  it.each([
    [null, 'SIN-DATOS'],
    [undefined, 'SIN-DATOS'],
    [{}, 'NORMAL · SIN-ASIGNAR'],
    [{ priority: false, owner: 0 }, 'NORMAL · SIN-ASIGNAR'],
    [{ priority: 2, owner: 'trainer' }, '2 · TRAINER']
  ])('characterizes missing and non-string values', (task, expected) => {
    expect(formatTaskLabel(task)).toBe(expected);
  });

  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });
});

describe('prepareTasks', () => {
  it('filters only exact ARCHIVED status and labels the original objects', () => {
    const visible = { status: 'TODO', priority: 'HIGH', owner: 'student' };
    const tasks = [visible, { status: 'ARCHIVED' }, { status: 'archived' }, {}];
    const result = prepareTasks(tasks);
    expect(result).toHaveLength(3);
    expect(result).toContain(visible);
    expect(visible).toHaveProperty('label', 'HIGH · STUDENT');
    expect(tasks).toHaveLength(4);
  });

  it.each([
    ['HIGH', 'LOW', ['LOW', 'HIGH']],
    ['Z', 'A', ['Z', 'A']],
    [2, 10, [10, 2]],
    ['2', 10, [10, '2']],
    [null, -1, [null, -1]],
    [undefined, 1, [undefined, 1]],
    [false, true, [true, false]],
    ['SAME', 'SAME', ['SAME', 'SAME']]
  ])('retains the legacy relational comparator for %s and %s', (first, second, expected) => {
    expect(prepareTasks([{ priority: first }, { priority: second }]).map((task) => task.priority)).toEqual(expected);
  });

  it('keeps an empty result', () => {
    expect(prepareTasks([])).toEqual([]);
  });
});
