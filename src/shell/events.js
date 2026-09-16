// Клики и submit -> action-объекты. Состояние отсюда не видно, только dispatch.
// Всё нечистое (Date.now, генерация id) делается здесь, в редьюсер приходят готовые значения.
import { isValidTitle } from '../core/task.js';
import {
  addTaskAction, toggleTaskAction, removeTaskAction, clearDoneAction,
  setFilterAction, setQueryAction, setSortAction,
} from '../core/reducer.js';

export const generateId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const restartAnimation = (element, className) => {
  element.classList.remove(className);
  void element.offsetWidth; // без reflow анимация второй раз не запустится
  element.classList.add(className);
};

const taskActions = {
  toggle: (id) => toggleTaskAction({ id, at: Date.now() }),
  remove: (id) => removeTaskAction(id),
};

// deps: dispatch, toast, restoreRemoved, setDaytimeChoice, togglePanel
// передаю аргументом, а не импортом из main.js - иначе был бы циклический импорт
export const bindEvents = (elements, deps) => {
  const { dispatch, toast } = deps;

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = elements.input.value;
    if (!isValidTitle(title)) {
      restartAnimation(elements.form, 'add-form--shake');
      elements.input.focus();
      return;
    }
    dispatch(addTaskAction({ id: generateId(), title, createdAt: Date.now() }));
    elements.input.value = '';
    elements.input.focus();
  });

  // один обработчик на весь список, карточки всё равно пересоздаются при рендере
  elements.list.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    const id = target?.closest('[data-id]')?.dataset.id;
    const name = target?.dataset.action;
    if (!id || !Object.hasOwn(taskActions, name)) return;

    dispatch(taskActions[name](id));
    if (name === 'remove') toast.show('Задача удалена', 'Вернуть', deps.restoreRemoved);
  });

  elements.clearDone.addEventListener('click', () => {
    dispatch(clearDoneAction());
    toast.show('Урожай собран: выросшие деревья убраны', 'Вернуть', deps.restoreRemoved);
  });

  elements.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) dispatch(setFilterAction(button.dataset.filter));
  });
  elements.search.addEventListener('input', () => dispatch(setQueryAction(elements.search.value)));
  elements.sort.addEventListener('change', () => dispatch(setSortAction(elements.sort.value)));

  elements.daytime.addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (button) deps.setDaytimeChoice(button.dataset.choice);
  });
  elements.panelToggle.addEventListener('click', deps.togglePanel);
};
