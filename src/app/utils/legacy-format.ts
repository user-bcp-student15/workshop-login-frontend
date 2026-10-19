import { WorkshopTask } from '../models/workshop.models';

export function formatTaskLabel(task: { priority?: unknown; owner?: unknown } | null | undefined): string {
  if (!task) {
    return 'SIN-DATOS';
  }
  const priority = task.priority ? String(task.priority).toUpperCase() : 'NORMAL';
  const owner = task.owner ? String(task.owner).toUpperCase() : 'SIN-ASIGNAR';
  return priority + ' · ' + owner;
}

export function prepareTasks(tasks: WorkshopTask[]): WorkshopTask[] {
  const visibleTasks = tasks.filter((task) => task.status !== 'ARCHIVED');
  for (const task of visibleTasks) {
    task.label = formatTaskLabel(task);
  }
  return visibleTasks.sort((left, right) => {
    const leftPriority = left.priority;
    const rightPriority = right.priority;
    const greater = typeof leftPriority === 'string' && typeof rightPriority === 'string'
      ? leftPriority > rightPriority
      : Number(leftPriority) > Number(rightPriority);
    return greater ? -1 : 1;
  });
}
