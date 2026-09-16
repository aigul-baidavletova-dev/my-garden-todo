/*
  Тесты для core (+ чистые шаблоны из render.js).

  Входные данные везде прогоняю через deepFreeze: модули в strict mode,
  так что если функция где-то мутирует аргумент, вылетит TypeError и тест упадёт.
  Данные для тестов делаются фабриками, чтобы тесты не делили один объект.
*/
import { test, describe, expect, run } from './runner.js';
import {
  pipe, compose, not, prop, propEq, always, allPass, anyPass, curry, last, scan, chunk, deepFreeze,
} from '../src/core/fp.js';
import {
  hashString, randomSequence, plantFor, SPECIES, gardenSlot, gardenRadius, gardenDecor, starField, PLANT_SPACING,
} from '../src/core/plant.js';
import { phaseOfHour, resolvePhase, isChoice, PHASES, SCENE_PALETTES } from '../src/core/daytime.js';
import {
  normalizeTitle, isValidTitle, createTask, toggleTask, isDone, isActive, isTask, MAX_TITLE_LENGTH,
} from '../src/core/task.js';
import {
  addTask, removeTask, updateTaskById, toggleTaskById, removeDone,
  byField, combineComparators, sortTasks, SORTS,
} from '../src/core/tasks.js';
import {
  FILTERS, isValidFilter, matchesQuery, selectVisibleTasks, selectStats, selectCounts,
} from '../src/core/filters.js';
import {
  reducer, viewReducer, appReducer, initialState, initialView, isState,
  serializeApp, restoreApp, restoreView,
  addTaskAction, toggleTaskAction, removeTaskAction, clearDoneAction,
  setFilterAction, setQueryAction, setSortAction,
} from '../src/core/reducer.js';
import {
  escapeHtml, pluralize, taskTemplate, emptyText, gardenSummary, formatClock, formatDay,
} from '../src/shell/render.js';

// --- хелперы для тестов ---

const makeTask = (overrides = {}) =>
  ({ id: 't1', title: 'Тест', done: false, createdAt: 1000, completedAt: null, ...overrides });

const add = (id, title) => addTaskAction({ id, title, createdAt: 1000 });
const toggle = (id) => toggleTaskAction({ id, at: 2000 });

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// --- fp.js ---

describe('fp', () => {
  test('pipe применяет слева направо', () => {
    expect(pipe((x) => x + 1, (x) => x * 2)(3)).toBe(8);
  });
  test('pipe без функций возвращает x как есть', () => {
    const obj = {};
    expect(pipe()(obj)).toBe(obj);
  });
  test('compose — это pipe в обратном порядке', () => {
    const inc = (x) => x + 1;
    const double = (x) => x * 2;
    expect(compose(double, inc)(5)).toBe(pipe(inc, double)(5));
  });
  test('not(not(p)) ведёт себя как p', () => {
    const isEven = (n) => n % 2 === 0;
    expect([1, 2, 3, 4].map(not(not(isEven)))).toEqual([1, 2, 3, 4].map(isEven));
  });
  test('prop и propEq', () => {
    expect([{ a: 1 }, { a: 2 }].map(prop('a'))).toEqual([1, 2]);
    expect(propEq('id', 'x')({ id: 'x' })).toBe(true);
  });
  test('allPass / anyPass / always', () => {
    const positive = (n) => n > 0;
    const even = (n) => n % 2 === 0;
    expect(allPass(positive, even)(4)).toBe(true);
    expect(allPass(positive, even)(3)).toBe(false);
    expect(anyPass(positive, even)(-2)).toBe(true);
    expect(always(true)()).toBe(true);
  });
  test('curry: любые порции аргументов', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    expect(sum3(1)(2)(3)).toBe(6);
    expect(sum3(1, 2)(3)).toBe(6);
  });
  test('scan возвращает все промежуточные значения', () => {
    expect(scan((a, b) => a + b, 0, [1, 2, 3])).toEqual([0, 1, 3, 6]);
    expect(last([1, 2, 3])).toBe(3);
  });
  test('chunk режет массив на куски', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  test('deepFreeze замораживает вложенные объекты', () => {
    const data = deepFreeze({ list: [{ x: 1 }] });
    expect(Object.isFrozen(data.list)).toBe(true);
    expect(Object.isFrozen(data.list[0])).toBe(true);
    expect(() => { data.list[0].x = 2; }).toThrow();
  });
});

// --- task.js ---

describe('task', () => {
  test('normalizeTitle убирает лишние пробелы', () => {
    expect(normalizeTitle('  купить   хлеб ')).toBe('купить хлеб');
    expect(normalizeTitle(undefined)).toBe('');
  });
  test('isValidTitle: пустые и слишком длинные нельзя', () => {
    expect(isValidTitle('   ')).toBe(false);
    expect(isValidTitle('ок')).toBe(true);
    expect(isValidTitle('я'.repeat(MAX_TITLE_LENGTH + 1))).toBe(false);
  });
  test('createTask: done === false, название нормализовано', () => {
    const task = createTask({ id: 'a', title: ' Хлеб ', createdAt: 5 });
    expect(task).toEqual({ id: 'a', title: 'Хлеб', done: false, createdAt: 5, completedAt: null });
  });
  test('toggleTask не меняет исходную задачу и возвращает другой объект', () => {
    const task = deepFreeze(makeTask());
    const done = toggleTask(task, 2000);
    expect(done).not.toBe(task);
    expect(done.done).toBe(true);
    expect(done.completedAt).toBe(2000);
    expect(task.done).toBe(false);
  });
  test('toggleTask дважды возвращает исходное содержимое', () => {
    const task = makeTask();
    expect(toggleTask(toggleTask(task, 1), 2)).toEqual(task);
  });
  test('isDone / isActive / isTask', () => {
    expect(isDone(makeTask({ done: true }))).toBe(true);
    expect(isActive(makeTask({ done: true }))).toBe(false);
    expect(isTask(makeTask())).toBe(true);
    expect(isTask({ ...makeTask(), createdAt: 'вчера' })).toBe(false);
  });
});

// --- tasks.js ---

describe('tasks', () => {
  const list = () => deepFreeze([makeTask({ id: 'a' }), makeTask({ id: 'b', done: true })]);

  test('addTask: длина +1, исходный массив не тронут', () => {
    const tasks = list();
    const next = addTask(tasks, makeTask({ id: 'c' }));
    expect(next.length).toBe(3);
    expect(tasks.length).toBe(2);
  });
  test('removeTask несуществующего id → ТОТ ЖЕ массив', () => {
    const tasks = list();
    expect(removeTask(tasks, 'нет')).toBe(tasks);
    expect(removeTask(tasks, 'a').map(prop('id'))).toEqual(['b']);
  });
  test('updateTaskById: незатронутые задачи — те же объекты', () => {
    const tasks = list();
    const next = updateTaskById(tasks, 'a', (task) => ({ ...task, title: 'Новое' }));
    expect(next[1]).toBe(tasks[1]);
    expect(next[0].title).toBe('Новое');
  });
  test('toggleTaskById меняет ровно одну задачу; несуществующий id → тот же массив', () => {
    const tasks = list();
    const next = toggleTaskById(tasks, 'a', 1);
    expect(next.filter(isDone).length).toBe(2);
    expect(toggleTaskById(tasks, 'нет', 1)).toBe(tasks);
  });
  test('removeDone; без выполненных → тот же массив', () => {
    expect(removeDone(list()).map(prop('id'))).toEqual(['a']);
    const active = deepFreeze([makeTask()]);
    expect(removeDone(active)).toBe(active);
  });
  test('sortTasks не меняет исходный порядок', () => {
    const tasks = deepFreeze([makeTask({ id: 'b', title: 'Б' }), makeTask({ id: 'a', title: 'А' })]);
    expect(sortTasks(tasks, byField('title')).map(prop('id'))).toEqual(['a', 'b']);
    expect(tasks.map(prop('id'))).toEqual(['b', 'a']);
  });
  test('combineComparators: второй спрашивается, только если первый дал 0', () => {
    const tasks = [
      makeTask({ id: 'done-old', done: true, createdAt: 1 }),
      makeTask({ id: 'active-new', createdAt: 3 }),
      makeTask({ id: 'active-old', createdAt: 2 }),
    ];
    const compare = combineComparators(byField('done'), byField('createdAt'));
    expect(sortTasks(tasks, compare).map(prop('id'))).toEqual(['active-old', 'active-new', 'done-old']);
    expect(sortTasks(tasks, SORTS.newest).map(prop('id'))).toEqual(['active-new', 'active-old', 'done-old']);
  });
});

// --- filters.js ---

describe('filters', () => {
  const tasks = deepFreeze([
    makeTask({ id: 'a', title: 'Купить хлеб' }),
    makeTask({ id: 'b', title: 'Сдать лабу', done: true }),
    makeTask({ id: 'c', title: 'Купить сыр', done: true }),
  ]);
  const view = (overrides) => ({ ...initialView, ...overrides });

  test('правильное количество видимых задач для каждого фильтра', () => {
    expect(selectVisibleTasks(tasks, view({ filter: 'all' })).length).toBe(3);
    expect(selectVisibleTasks(tasks, view({ filter: 'active' })).length).toBe(1);
    expect(selectVisibleTasks(tasks, view({ filter: 'done' })).length).toBe(2);
  });
  test('фильтр и поиск складываются в один предикат', () => {
    const visible = selectVisibleTasks(tasks, view({ filter: 'done', query: '  КУПИТЬ ' }));
    expect(visible.map(prop('id'))).toEqual(['c']);
  });
  test('пустой поиск пропускает всё', () => {
    expect(tasks.every(matchesQuery(''))).toBe(true);
  });
  test('selectStats на пустом списке: progress === 0, а не NaN', () => {
    expect(selectStats([])).toEqual({ active: 0, done: 0, total: 0, progress: 0 });
  });
  test('active + done === total; счётчики для фильтров', () => {
    const stats = selectStats(tasks);
    expect(stats.active + stats.done).toBe(stats.total);
    expect(selectCounts(tasks)).toEqual({ all: 3, active: 1, done: 2 });
  });
  test('isValidFilter', () => {
    expect(Object.keys(FILTERS).every(isValidFilter)).toBe(true);
    expect(isValidFilter('toString')).toBe(false);
  });
});

// --- reducer.js ---

describe('reducer', () => {
  const state = () => deepFreeze({ tasks: [makeTask({ id: 'a', title: 'Хлеб' })] });

  test('неизвестное действие → ТОТ ЖЕ state', () => {
    const s = state();
    expect(reducer(s, { type: 'что-то/странное' })).toBe(s);
    expect(reducer(s, { type: 'constructor' })).toBe(s);
  });
  test('task/add с пустым title или повторным id → тот же state', () => {
    const s = state();
    expect(reducer(s, add('b', '   '))).toBe(s);
    expect(reducer(s, add('a', 'Дубликат'))).toBe(s);
  });
  test('add, toggle, clearDone, remove не мутируют вход (ловушка deepFreeze)', () => {
    const s1 = reducer(state(), add('b', 'Сыр'));
    const s2 = reducer(deepFreeze(s1), toggle('b'));
    const s3 = reducer(deepFreeze(s2), clearDoneAction());
    const s4 = reducer(deepFreeze(s3), removeTaskAction('a'));
    expect(s1.tasks.map(prop('title'))).toEqual(['Хлеб', 'Сыр']);
    expect(s2.tasks[1].done).toBe(true);
    expect(s3.tasks.map(prop('id'))).toEqual(['a']);
    expect(s4.tasks).toEqual([]);
  });
  test('toggle и remove несуществующего id → ТОТ ЖЕ state', () => {
    const s = state();
    expect(reducer(s, toggle('нет'))).toBe(s);
    expect(reducer(s, removeTaskAction('нет'))).toBe(s);
  });
  test('viewReducer: валидные значения меняют вид, невалидные — нет', () => {
    const view = deepFreeze({ ...initialView });
    expect(viewReducer(view, setFilterAction('done')).filter).toBe('done');
    expect(viewReducer(view, setFilterAction('мусор'))).toBe(view);
    expect(viewReducer(view, setFilterAction('all'))).toBe(view);
    expect(viewReducer(view, setQueryAction('хлеб')).query).toBe('хлеб');
    expect(viewReducer(view, setSortAction('title')).sort).toBe('title');
    expect(viewReducer(view, add('a', 'x'))).toBe(view);
  });
  test('appReducer: ничего не изменилось → тот же объект приложения', () => {
    const app = deepFreeze({ state: initialState, view: initialView });
    expect(appReducer(app, { type: 'непонятно' })).toBe(app);
    const next = appReducer(app, add('a', 'Хлеб'));
    expect(next.view).toBe(app.view);
    expect(next.state.tasks.length).toBe(1);
  });
  test('serializeApp → restoreApp: те же задачи и вид, поиск не сохраняется', () => {
    const app = { state: { tasks: [makeTask()] }, view: { filter: 'done', query: 'хлеб', sort: 'title' } };
    const restored = restoreApp(JSON.parse(JSON.stringify(serializeApp(app))));
    expect(restored.state).toEqual(app.state);
    expect(restored.view).toEqual({ filter: 'done', query: '', sort: 'title' });
  });
  test('restoreApp: мусор в localStorage → чистый лист', () => {
    expect(restoreApp(null)).toEqual({ state: initialState, view: initialView });
    expect(restoreApp({ version: 2, tasks: [{ id: 1 }] }).state).toBe(initialState);
    expect(restoreApp({ version: 1, tasks: [makeTask()] }).state).toBe(initialState);
    expect(isState({ tasks: 'много' })).toBe(false);
    expect(restoreView({ filter: 'done', sort: 'хаос' })).toEqual({ ...initialView, filter: 'done' });
  });
});

// --- plant.js ---

describe('растения', () => {
  test('hashString детерминирован и различает строки', () => {
    expect(hashString('дуб')).toBe(hashString('дуб'));
    expect(hashString('дуб')).not.toBe(hashString('ель'));
  });
  test('randomSequence: числа от 0 до 1, одно зерно → одна последовательность', () => {
    const numbers = randomSequence(42, 500);
    expect(numbers.length).toBe(500);
    expect(numbers.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(randomSequence(42, 10)).toEqual(numbers.slice(0, 10));
    expect(randomSequence(43, 10)).not.toEqual(numbers.slice(0, 10));
  });
  test('plantFor — чистая функция: тот же id → то же дерево', () => {
    expect(plantFor('задача-1')).toEqual(plantFor('задача-1'));
  });
  test('встречаются все породы деревьев', () => {
    const species = new Set(Array.from({ length: 200 }, (_, i) => plantFor(`t${i}`).species));
    expect(SPECIES.every((name) => species.has(name))).toBe(true);
  });
  test('размеры дерева в разумных пределах', () => {
    const plants = Array.from({ length: 100 }, (_, i) => plantFor(`p${i}`));
    expect(plants.every((p) => p.scale >= 0.85 && p.scale <= 1.2 && p.trunkHeight > 0.8 && p.trunkHeight < 2)).toBe(true);
    expect(plants.every((p) => p.crown.length === 5 && p.fruits.length === 7 && p.tiers.length === 4)).toBe(true);
    expect(plants.every((p) => p.fruits.every((f) => f.blob >= 0 && f.blob < 5))).toBe(true);
  });
});

describe('план сада', () => {
  test('gardenSlot — чистая функция: то же место для того же номера', () => {
    expect(gardenSlot(7)).toEqual(gardenSlot(7));
  });
  test('растения не налезают друг на друга', () => {
    const slots = Array.from({ length: 60 }, (_, i) => gardenSlot(i));
    const closest = Math.min(...slots.flatMap((a, i) => slots.slice(i + 1).map((b) => distance(a, b))));
    expect(closest > PLANT_SPACING * 0.7).toBe(true);
  });
  test('все растения помещаются в радиус сада', () => {
    const count = 40;
    const slots = Array.from({ length: count }, (_, i) => gardenSlot(i));
    expect(slots.every((s) => Math.hypot(s.x, s.z) < gardenRadius(count))).toBe(true);
  });
  test('декор и звёзды одинаковые при каждом запуске', () => {
    expect(gardenDecor(20)).toEqual(gardenDecor(20));
    expect(starField(50).every((s) => s.y > 0 && Math.abs(Math.hypot(s.x, s.y, s.z) - 1) < 1e-9)).toBe(true);
  });
});

// --- daytime.js ---

describe('время суток', () => {
  test('phaseOfHour: границы утра, вечера и ночи', () => {
    const hours = [0, 4, 5, 12, 16, 17, 21, 22, 23];
    expect(hours.map(phaseOfHour)).toEqual(
      ['night', 'night', 'morning', 'morning', 'morning', 'evening', 'evening', 'night', 'night'],
    );
  });
  test('resolvePhase: «авто» смотрит на час, ручной выбор — нет', () => {
    expect(resolvePhase('auto', 23)).toBe('night');
    expect(resolvePhase('morning', 23)).toBe('morning');
    expect(resolvePhase('мусор', 18)).toBe('evening');
  });
  test('isChoice и палитры для каждого времени суток', () => {
    expect(isChoice('auto') && isChoice('night') && !isChoice('полдень')).toBe(true);
    expect(PHASES.every((phase) => typeof SCENE_PALETTES[phase].skyTop === 'string')).toBe(true);
  });
});

// --- render.js (только шаблоны) ---

describe('шаблоны', () => {
  test('escapeHtml обезвреживает разметку', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
  test('taskTemplate экранирует название задачи (XSS)', () => {
    const html = taskTemplate(makeTask({ title: '<script>alert(1)</script>' }));
    expect(html.includes('<script>')).toBe(false);
  });
  test('pluralize: русские окончания', () => {
    const forms = ['задача', 'задачи', 'задач'];
    expect([0, 1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => pluralize(n, forms))).toEqual(
      ['задач', 'задача', 'задачи', 'задач', 'задач', 'задач', 'задача', 'задачи', 'задач', 'задач'],
    );
  });
  test('gardenSummary: голая земля и склонения', () => {
    expect(gardenSummary({ done: 0, active: 0 })).toBe('Голая земля. Посади первое семечко');
    expect(gardenSummary({ done: 2, active: 1 })).toBe('Выросло 2 дерева · 1 росток ждёт');
    expect(gardenSummary({ done: 5, active: 3 })).toBe('Выросло 5 деревьев · 3 ростка ждут');
  });
  test('часы и дата: время передаётся аргументом, поэтому результат предсказуем', () => {
    const morning = new Date(2026, 8, 16, 9, 5);
    expect(formatClock(morning)).toBe('09:05');
    expect(formatDay(morning)).toBe('Среда, 16 сентября');
    expect(formatClock(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
  });
  test('emptyText зависит от фильтра и поиска', () => {
    expect(emptyText({ ...initialView, filter: 'done' })).toBe('Пока ни одно дерево не выросло');
    expect(emptyText({ ...initialView, query: ' хлеб ' })).toBe('Ничего не нашлось по запросу «хлеб»');
  });
});

run();
