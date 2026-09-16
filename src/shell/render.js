/*
  Отрисовка панели задач (сад рисует scene.js).
  Сверху чистые шаблоны - данные в строку HTML, их гоняют тесты.
  Снизу то, что лезет в DOM. Состояние отсюда только читается.
*/
import { selectVisibleTasks, selectStats, selectCounts } from '../core/filters.js';

// --- шаблоны ---

// названия задач вставляются через innerHTML, так что экранируем, иначе XSS
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// 1 задача, 2 задачи, 5 задач, 11 задач, 21 задача
export const pluralize = (n, [one, few, many]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

// uuid может начинаться с цифры, а view-transition-name так не примет
const cssIdent = (id) => `task-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

const dateFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export const taskTemplate = (task) => {
  const id = escapeHtml(task.id);
  const title = escapeHtml(task.title);
  return `
    <li class="task${task.done ? ' task--done' : ''}" data-id="${id}"
        style="view-transition-name: ${cssIdent(task.id)}">
      <input class="task__toggle" id="toggle-${id}" type="checkbox" data-action="toggle"${task.done ? ' checked' : ''}>
      <label class="task__title" for="toggle-${id}">${title}</label>
      <button class="task__remove" type="button" data-action="remove" aria-label="Удалить задачу «${title}»">×</button>
      <time class="task__meta" datetime="${new Date(task.createdAt).toISOString()}">${dateFormatter.format(task.createdAt)}</time>
    </li>`;
};

export const listTemplate = (tasks) => tasks.map(taskTemplate).join('');

const EMPTY_TEXTS = {
  all: 'Грядка пуста. Что посадим?',
  active: 'Все ростки выросли в деревья',
  done: 'Пока ни одно дерево не выросло',
};

export const emptyText = (view) =>
  view.query.trim() !== '' ? `Ничего не нашлось по запросу «${view.query.trim()}»` : EMPTY_TEXTS[view.filter];

// дату передаём снаружи, так формат можно проверить в тестах на фиксированной дате
const timeFormatter = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatClock = (date) => timeFormatter.format(date);

// Intl отдаёт "среда, 16 сентября" с маленькой буквы
export const formatDay = (date) => {
  const text = dayFormatter.format(date);
  return text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
};

export const gardenSummary = ({ done, active }) =>
  done + active === 0
    ? 'Голая земля. Посади первое семечко'
    : `Выросло ${done} ${pluralize(done, ['дерево', 'дерева', 'деревьев'])} · ` +
      `${active} ${pluralize(active, ['росток ждёт', 'ростка ждут', 'ростков ждут'])}`;

// --- DOM ---

const $ = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`В index.html не найден элемент ${selector}`);
  return element;
};

// ищем элементы один раз при старте, а не на каждый рендер
export const getElements = () => ({
  root: document.documentElement,
  body: document.body,
  canvas: $('#garden-canvas'),
  gardenFallback: $('#garden-fallback'),
  tooltip: $('#plant-tooltip'),
  daytime: $('#daytime'),
  daytimeButtons: [...document.querySelectorAll('[data-choice]')],
  panel: $('#panel'),
  panelToggle: $('#panel-toggle'),
  clock: $('#clock'),
  date: $('#date'),
  gardenSummary: $('#garden-summary'),
  form: $('#add-form'),
  input: $('#task-title'),
  filters: $('#filters'),
  filterButtons: [...document.querySelectorAll('[data-filter]')],
  search: $('#search'),
  sort: $('#sort'),
  list: $('#task-list'),
  empty: $('#empty'),
  emptyText: $('#empty-text'),
  remaining: $('#remaining'),
  clearDone: $('#clear-done'),
  toast: $('#toast'),
  toastMessage: $('#toast-message'),
  toastAction: $('#toast-action'),
  welcome: $('#welcome'),
});

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// что было на экране в прошлый раз - анимируем только новые и только что выполненные,
// а не весь список
const shown = { doneById: new Map() };

// после innerHTML фокус слетает (элементы-то новые), поэтому запоминаем и возвращаем
const captureFocus = (container) => {
  const active = document.activeElement;
  if (!active || !container.contains(active)) return null;
  return { action: active.dataset.action, taskId: active.closest('[data-id]')?.dataset.id };
};

const restoreFocus = (container, focus, fallback) => {
  if (!focus || container.contains(document.activeElement)) return;
  const selector = `[data-id="${CSS.escape(focus.taskId ?? '')}"] [data-action="${focus.action}"]`;
  (container.querySelector(selector) ?? fallback())?.focus({ preventScroll: true });
};

export const renderTasks = (elements, tasks, view, { animate = false } = {}) => {
  const visible = selectVisibleTasks(tasks, view);
  const useViewTransition = animate && 'startViewTransition' in document && !prefersReducedMotion();

  const update = () => {
    const focus = captureFocus(elements.list);
    elements.list.innerHTML = listTemplate(visible);

    if (animate) {
      visible.forEach((task) => {
        const card = elements.list.querySelector(`[data-id="${CSS.escape(task.id)}"]`);
        const wasShown = shown.doneById.has(task.id);
        if (!wasShown && !useViewTransition) card.classList.add('task--enter');
        if (wasShown && task.done && !shown.doneById.get(task.id)) card.classList.add('task--bloom');
      });
    }
    shown.doneById = new Map(visible.map((task) => [task.id, task.done]));

    restoreFocus(elements.list, focus, () => elements.input);
    elements.empty.hidden = visible.length > 0;
    elements.emptyText.textContent = emptyText(view);
  };

  // если кликать быстро, переход отменяется и ready реджектится - это не ошибка, глушим
  if (useViewTransition) document.startViewTransition(update).ready.catch(() => {});
  else update();
};

export const renderChrome = (elements, tasks, view) => {
  const stats = selectStats(tasks);
  const counts = selectCounts(tasks);

  elements.filterButtons.forEach((button) => {
    const name = button.dataset.filter;
    button.setAttribute('aria-pressed', String(name === view.filter));
    button.querySelector('[data-count]').textContent = counts[name];
  });
  if (elements.sort.value !== view.sort) elements.sort.value = view.sort;

  elements.gardenSummary.textContent = gardenSummary(stats);
  elements.remaining.textContent =
    `Осталось ${stats.active} ${pluralize(stats.active, ['задача', 'задачи', 'задач'])}`;
  elements.clearDone.disabled = stats.done === 0;
};

// вся панель целиком
export const render = (elements, app, { animate = false } = {}) => {
  renderTasks(elements, app.state.tasks, app.view, { animate });
  renderChrome(elements, app.state.tasks, app.view);
};

// цвета панели переключаются в CSS по data-daytime
export const renderDaytime = (elements, choice, phase) => {
  elements.root.dataset.daytime = phase;
  elements.daytimeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.choice === choice));
  });
};

// дёргается каждую секунду, поэтому в DOM пишем только когда текст реально поменялся
export const renderClock = (elements, date) => {
  const time = formatClock(date);
  if (elements.clock.textContent !== time) {
    elements.clock.textContent = time;
    elements.clock.dateTime = date.toISOString();
  }
  const day = formatDay(date);
  if (elements.date.textContent !== day) elements.date.textContent = day;
};

// подсказка над деревом при наведении
export const renderTooltip = (elements, info, x = 0, y = 0) => {
  elements.tooltip.hidden = info === null;
  if (info === null) return;
  elements.tooltip.textContent = `${info.title} · ${info.kind}`;
  elements.tooltip.style.left = `${x}px`;
  elements.tooltip.style.top = `${y}px`;
};

export const setPanelCollapsed = (elements, collapsed) => {
  elements.panel.classList.toggle('panel--collapsed', collapsed);
  elements.panelToggle.setAttribute('aria-expanded', String(!collapsed));
  elements.panelToggle.querySelector('.panel__toggle-label').textContent = collapsed ? 'Показать задачи' : 'Смотреть сад';
};

// --- тост ---

export const createToast = (elements, duration = 6000) => {
  const current = { timer: null, onAction: null };

  const hide = () => {
    clearTimeout(current.timer);
    current.onAction = null;
    elements.toast.hidden = true;
  };

  const show = (message, actionLabel = null, onAction = null) => {
    clearTimeout(current.timer);
    elements.toastMessage.textContent = message;
    elements.toastAction.hidden = actionLabel === null;
    elements.toastAction.textContent = actionLabel ?? '';
    current.onAction = onAction;
    elements.toast.hidden = false;
    current.timer = setTimeout(hide, duration);
  };

  elements.toastAction.addEventListener('click', () => {
    const { onAction } = current;
    hide();
    onAction?.();
  });

  return { show, hide };
};
