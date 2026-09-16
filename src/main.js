// Точка входа: тут всё связывается. Логики почти нет, только проводка:
// action -> новое состояние -> сохранить -> перерисовать панель и сад.
import { deepFreeze } from './core/fp.js';
import { ActionType, appReducer, serializeApp, restoreApp } from './core/reducer.js';
import { resolvePhase, isChoice } from './core/daytime.js';
import {
  getElements, render, renderDaytime, renderClock, renderTooltip, setPanelCollapsed, createToast, prefersReducedMotion,
} from './shell/render.js';
import { bindEvents } from './shell/events.js';
import { loadJson, saveJson, onExternalChange } from './shell/storage.js';

const STORAGE_KEY = 'garden/v2';
const DAYTIME_KEY = 'garden/daytime';

// на localhost морозим каждое состояние, чтобы мутации ловились сразу
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const freeze = (value) => (DEV ? deepFreeze(value) : value);

// что анимируем в списке (поиск нет - при каждой букве дёргалось бы)
const ANIMATED = new Set([
  ActionType.ADD, ActionType.TOGGLE, ActionType.REMOVE, ActionType.CLEAR_DONE,
  ActionType.SET_FILTER, ActionType.SET_SORT,
]);

// после них в тосте есть "Вернуть"
const RESTORABLE = new Set([ActionType.REMOVE, ActionType.CLEAR_DONE]);

// let тут осознанно: переменные переприсваиваются,
// но сами объекты состояния никто не меняет
let app = freeze(restoreApp(loadJson(STORAGE_KEY)));
let appBeforeRemoval = null; // старое состояние целиком, копировать ничего не надо
let daytimeChoice = isChoice(loadJson(DAYTIME_KEY)) ? loadJson(DAYTIME_KEY) : 'auto';

const elements = getElements();
const toast = createToast(elements);
const garden = { scene: null }; // заполнится, когда подгрузится three.js

// new Date() читаем здесь, а в daytime.js отдаём уже просто число
const currentPhase = () => resolvePhase(daytimeChoice, new Date().getHours());

const commit = (next, options) => {
  app = freeze(next);
  saveJson(STORAGE_KEY, serializeApp(app));
  render(elements, app, options);
  garden.scene?.sync(app.state.tasks);
};

const dispatch = (action) => {
  const next = appReducer(app, action);
  if (next === app) return;
  if (next.state !== app.state) toast.hide();
  if (RESTORABLE.has(action.type)) appBeforeRemoval = app;
  commit(next, { animate: ANIMATED.has(action.type) });
};

const restoreRemoved = () => {
  if (!appBeforeRemoval) return;
  const { state } = appBeforeRemoval;
  appBeforeRemoval = null;
  commit({ state, view: app.view }, { animate: true });
};

const applyDaytime = ({ instant = false } = {}) => {
  const phase = currentPhase();
  renderDaytime(elements, daytimeChoice, phase);
  garden.scene?.setPhase(phase, { instant });
};

const setDaytimeChoice = (choice) => {
  if (!isChoice(choice)) return;
  daytimeChoice = choice;
  saveJson(DAYTIME_KEY, choice);
  applyDaytime();
};

// чтобы сад не прятался за панелью, сдвигаем картинку в свободную часть экрана
const updateViewShift = () => {
  const rect = elements.panel.getBoundingClientRect();
  const collapsed = elements.panel.classList.contains('panel--collapsed');
  const wide = window.matchMedia('(min-width: 50rem)').matches;
  if (collapsed) garden.scene?.setViewShift(0, 0);
  else if (wide) garden.scene?.setViewShift(rect.right / 2, 0);
  else garden.scene?.setViewShift(0, (window.innerHeight - rect.top) / 2);
};

const togglePanel = () => {
  setPanelCollapsed(elements, !elements.panel.classList.contains('panel--collapsed'));
  updateViewShift();
};

// --- старт ---

bindEvents(elements, { dispatch, toast, restoreRemoved, setDaytimeChoice, togglePanel });
render(elements, app);

// окно приветствия; закрывается кнопкой или Esc, после - сразу фокус в поле ввода
elements.welcome.showModal();
elements.welcome.addEventListener('close', () => elements.input.focus());
applyDaytime({ instant: true });

// часы в шапке
renderClock(elements, new Date());
setInterval(() => renderClock(elements, new Date()), 1000);

// раз в минуту проверяем, не наступил ли вечер
setInterval(applyDaytime, 60_000);

new ResizeObserver(updateViewShift).observe(elements.panel);
window.addEventListener('resize', updateViewShift);

// если задачи поменяли в другой вкладке (поиск в этой не сбрасываем)
onExternalChange(STORAGE_KEY, (data) => {
  app = freeze({ ...restoreApp(data), view: { ...restoreApp(data).view, query: app.view.query } });
  render(elements, app);
  garden.scene?.sync(app.state.tasks);
});

// three.js грузим динамически: если WebGL нет или что-то упало, задачи всё равно работают
import('./shell/scene.js')
  .then(({ createGardenScene }) => {
    garden.scene = createGardenScene(elements.canvas, {
      reducedMotion: prefersReducedMotion(),
      onHover: (info, x, y) => renderTooltip(elements, info, x, y),
    });
    garden.scene.sync(app.state.tasks, { animate: false });
    applyDaytime({ instant: true });
    updateViewShift();
  })
  .catch((error) => {
    console.warn('3D-сад недоступен:', error);
    elements.body.classList.add('no-webgl');
    elements.gardenFallback.hidden = false;
  });
