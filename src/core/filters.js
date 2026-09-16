// Фильтры и селекторы. Отфильтрованный список и счётчики в состоянии не храню,
// а каждый раз считаю из tasks - так они никогда не разъедутся с данными.
import { always, allPass } from './fp.js';
import { isDone, isActive } from './task.js';
import { SORTS, sortTasks } from './tasks.js';

// вместо switch по названию фильтра
export const FILTERS = Object.freeze({
  all: always(true),
  active: isActive,
  done: isDone,
});

export const FILTER_NAMES = Object.keys(FILTERS);

export const isValidFilter = (name) => Object.hasOwn(FILTERS, name);

// возвращает предикат, needle остаётся в замыкании
export const matchesQuery = (query) => {
  const needle = String(query ?? '').trim().toLocaleLowerCase('ru');
  return needle === ''
    ? always(true)
    : (task) => task.title.toLocaleLowerCase('ru').includes(needle);
};

// view = { filter, query, sort }
export const selectVisibleTasks = (tasks, view) =>
  sortTasks(
    tasks.filter(allPass(FILTERS[view.filter] ?? FILTERS.all, matchesQuery(view.query))),
    SORTS[view.sort] ?? SORTS.created,
  );

// за один reduce, а не три filter().length
export const selectStats = (tasks) => {
  const counts = tasks.reduce(
    (acc, task) => (isDone(task) ? { ...acc, done: acc.done + 1 } : { ...acc, active: acc.active + 1 }),
    { active: 0, done: 0 },
  );
  const total = counts.active + counts.done;
  return { ...counts, total, progress: total === 0 ? 0 : counts.done / total };
};

// цифры на кнопках фильтров
export const selectCounts = (tasks) => {
  const { total, active, done } = selectStats(tasks);
  return { all: total, active, done };
};
