// Одна задача: { id, title, done, createdAt, completedAt }
// Все функции возвращают новый объект, старый не трогаем.
import { pipe, prop, not } from './fp.js';

export const MAX_TITLE_LENGTH = 120;

const toText = (raw) => (typeof raw === 'string' ? raw : '');
const trim = (text) => text.trim();
const collapseSpaces = (text) => text.replace(/\s+/g, ' ');

// '  купить   хлеб ' -> 'купить хлеб'
export const normalizeTitle = pipe(toText, trim, collapseSpaces);

export const isValidTitle = pipe(
  normalizeTitle,
  (title) => title.length > 0 && title.length <= MAX_TITLE_LENGTH,
);

export const createTask = ({ id, title, createdAt }) => ({
  id,
  title: normalizeTitle(title),
  done: false,
  createdAt,
  completedAt: null,
});

export const toggleTask = (task, at) => ({
  ...task,
  done: !task.done,
  completedAt: task.done ? null : at,
});

export const isDone = prop('done');
export const isActive = not(isDone);

// проверка того, что достали из localStorage
export const isTask = (x) =>
  typeof x === 'object' && x !== null &&
  typeof x.id === 'string' &&
  typeof x.title === 'string' &&
  typeof x.done === 'boolean' &&
  Number.isFinite(x.createdAt) &&
  (x.completedAt === null || Number.isFinite(x.completedAt));
