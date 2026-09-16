// Операции над списком задач. Никаких push/splice/sort - только map, filter, reduce и т.п.
// Если по факту ничего не поменялось, возвращаю тот же массив, а не копию:
// тогда выше по цепочке видно, что перерисовывать нечего.
import { not, propEq } from './fp.js';
import { toggleTask, isDone } from './task.js';

export const hasTask = (tasks, id) => tasks.some(propEq('id', id));

export const addTask = (tasks, task) => [...tasks, task];

export const removeTask = (tasks, id) =>
  hasTask(tasks, id) ? tasks.filter(not(propEq('id', id))) : tasks;

// остальные задачи остаются теми же объектами
export const updateTaskById = (tasks, id, updater) =>
  hasTask(tasks, id) ? tasks.map((task) => (task.id === id ? updater(task) : task)) : tasks;

export const toggleTaskById = (tasks, id, at) =>
  updateTaskById(tasks, id, (task) => toggleTask(task, at));

export const removeDone = (tasks) => (tasks.some(isDone) ? tasks.filter(not(isDone)) : tasks);

// --- сортировка ---

const compareValues = (a, b) =>
  typeof a === 'string' && typeof b === 'string'
    ? a.localeCompare(b, 'ru', { sensitivity: 'base' })
    : Number(a) - Number(b);

// byField('title'), byField('createdAt', 'desc')
export const byField = (key, direction = 'asc') => (a, b) =>
  (direction === 'desc' ? -1 : 1) * compareValues(a[key], b[key]);

// пока предыдущий компаратор говорит 0, спрашиваем следующий
export const combineComparators = (...comparators) => (a, b) =>
  comparators.reduce((result, compare) => (result !== 0 ? result : compare(a, b)), 0);

// не sort - он меняет исходный массив
export const sortTasks = (tasks, comparator) => tasks.toSorted(comparator);

export const SORTS = Object.freeze({
  created: byField('createdAt'),
  newest: byField('createdAt', 'desc'),
  title: combineComparators(byField('title'), byField('createdAt')),
  activeFirst: combineComparators(byField('done'), byField('createdAt')),
});

export const SORT_NAMES = Object.keys(SORTS);
