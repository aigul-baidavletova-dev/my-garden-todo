// Редьюсеры. Их два: reducer отвечает за задачи (это сохраняется),
// viewReducer - за то, как их показывать (фильтр, поиск, сортировка).
import { isValidTitle, createTask, isTask } from './task.js';
import { hasTask, addTask, removeTask, toggleTaskById, removeDone, SORTS } from './tasks.js';
import { isValidFilter } from './filters.js';

// строки в одном месте: опечатка ActionType.ADDD сразу даст undefined
export const ActionType = Object.freeze({
  ADD: 'task/add',
  TOGGLE: 'task/toggle',
  REMOVE: 'task/remove',
  CLEAR_DONE: 'tasks/clearDone',
  SET_FILTER: 'view/filter',
  SET_QUERY: 'view/query',
  SET_SORT: 'view/sort',
});

// --- action creators ---
// id и время генерит events.js, сюда они приходят уже готовыми

export const addTaskAction = ({ id, title, createdAt }) => ({ type: ActionType.ADD, id, title, createdAt });
export const toggleTaskAction = ({ id, at }) => ({ type: ActionType.TOGGLE, id, at });
export const removeTaskAction = (id) => ({ type: ActionType.REMOVE, id });
export const clearDoneAction = () => ({ type: ActionType.CLEAR_DONE });

export const setFilterAction = (filter) => ({ type: ActionType.SET_FILTER, filter });
export const setQueryAction = (query) => ({ type: ActionType.SET_QUERY, query });
export const setSortAction = (sort) => ({ type: ActionType.SET_SORT, sort });

// --- задачи ---

export const initialState = { tasks: [] };

export const isState = (x) =>
  typeof x === 'object' && x !== null && Array.isArray(x.tasks) && x.tasks.every(isTask);

// массив не поменялся -> отдаём старый state, чтобы не было лишней перерисовки
const withTasks = (state, tasks) => (tasks === state.tasks ? state : { ...state, tasks });

const handlers = {
  [ActionType.ADD]: (state, action) =>
    typeof action.id === 'string' && Number.isFinite(action.createdAt) &&
    isValidTitle(action.title) && !hasTask(state.tasks, action.id)
      ? withTasks(state, addTask(state.tasks, createTask(action)))
      : state,
  [ActionType.TOGGLE]: (state, action) =>
    Number.isFinite(action.at) ? withTasks(state, toggleTaskById(state.tasks, action.id, action.at)) : state,
  [ActionType.REMOVE]: (state, action) => withTasks(state, removeTask(state.tasks, action.id)),
  [ActionType.CLEAR_DONE]: (state) => withTasks(state, removeDone(state.tasks)),
};

const identity = (state) => state;

export const reducer = (state, action) =>
  (Object.hasOwn(handlers, action?.type) ? handlers[action.type] : identity)(state, action);

// --- вид экрана ---

export const initialView = { filter: 'all', query: '', sort: 'created' };

const setField = (view, key, value) => (view[key] === value ? view : { ...view, [key]: value });

const viewHandlers = {
  [ActionType.SET_FILTER]: (view, action) =>
    isValidFilter(action.filter) ? setField(view, 'filter', action.filter) : view,
  [ActionType.SET_QUERY]: (view, action) =>
    typeof action.query === 'string' ? setField(view, 'query', action.query) : view,
  [ActionType.SET_SORT]: (view, action) =>
    Object.hasOwn(SORTS, action.sort) ? setField(view, 'sort', action.sort) : view,
};

export const viewReducer = (view, action) =>
  (Object.hasOwn(viewHandlers, action?.type) ? viewHandlers[action.type] : identity)(view, action);

// app = { state, view }
export const appReducer = (app, action) => {
  const state = reducer(app.state, action);
  const view = viewReducer(app.view, action);
  return state === app.state && view === app.view ? app : { state, view };
};

// --- сохранение ---
// query не сохраняю: после перезагрузки поиск логичнее видеть пустым

export const serializeApp = (app) => ({
  version: 2,
  tasks: app.state.tasks,
  view: { filter: app.view.filter, sort: app.view.sort },
});

export const restoreView = (data) => ({
  ...initialView,
  filter: isValidFilter(data?.filter) ? data.filter : initialView.filter,
  sort: Object.hasOwn(SORTS, data?.sort ?? '') ? data.sort : initialView.sort,
});

// в localStorage может лежать что угодно - если не похоже на наши данные, начинаем с нуля
export const restoreApp = (data) => ({
  state: data?.version === 2 && isState({ tasks: data.tasks }) ? { tasks: data.tasks } : initialState,
  view: restoreView(data?.view),
});
