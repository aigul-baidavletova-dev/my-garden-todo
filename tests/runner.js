// Мини-аналог Jest. Настоящий Jest тянет npm и сборку, а по заданию только HTML/CSS/JS.
// Работает и в браузере (tests/index.html), и в node.

// --- сравнение ---

export const deepEqual = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null
      && !Array.isArray(a) && !Array.isArray(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  return Number.isNaN(a) && Number.isNaN(b);
};

const show = (value) => {
  if (typeof value === 'function') return `[функция ${value.name || 'без имени'}]`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

// --- матчеры ---

const fail = (message) => {
  throw new Error(message);
};

export const expect = (actual) => ({
  toBe: (expected) =>
    Object.is(actual, expected) ||
    fail(`Ожидался тот же объект/значение: ${show(expected)}, получено: ${show(actual)}`),
  not: {
    toBe: (expected) =>
      !Object.is(actual, expected) || fail(`Ожидался ДРУГОЙ объект, получен тот же: ${show(actual)}`),
    toEqual: (expected) =>
      !deepEqual(actual, expected) || fail(`Ожидалось отличие от: ${show(expected)}`),
  },
  toEqual: (expected) =>
    deepEqual(actual, expected) || fail(`Ожидалось: ${show(expected)}, получено: ${show(actual)}`),
  toBeTruthy: () => Boolean(actual) || fail(`Ожидалось истинное значение, получено: ${show(actual)}`),
  toBeFalsy: () => !actual || fail(`Ожидалось ложное значение, получено: ${show(actual)}`),
  toThrow: () => {
    try {
      actual();
    } catch {
      return true;
    }
    return fail('Ожидалось, что функция бросит ошибку');
  },
});

// --- запуск ---

// тут мутабельно и ладно, это не ядро приложения
const registry = [];
const groups = [];

export const describe = (groupName, fn) => {
  groups.push(groupName);
  fn();
  groups.pop();
};

export const test = (name, fn) => {
  registry.push({ name: [...groups, name].join(' › '), fn });
};

const runOne = ({ name, fn }) => {
  try {
    fn();
    return { name, passed: true, error: null };
  } catch (error) {
    return { name, passed: false, error: error.message };
  }
};

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const renderResults = (results, passedCount) => {
  const list = document.querySelector('#results');
  const summary = document.querySelector('#summary');
  if (!list || !summary) return;

  list.innerHTML = results
    .map(({ name, passed, error }) => `
      <li class="result result--${passed ? 'pass' : 'fail'}">
        <span class="result__mark" aria-hidden="true">${passed ? '✓' : '✗'}</span>
        <span class="result__name">${escapeHtml(name)}</span>
        ${error ? `<pre class="result__error">${escapeHtml(error)}</pre>` : ''}
      </li>`)
    .join('');

  const allPassed = passedCount === results.length;
  summary.textContent = `Выросло ${passedCount} из ${results.length}`;
  summary.classList.toggle('summary--pass', allPassed);
  summary.classList.toggle('summary--fail', !allPassed);
  document.title = `${allPassed ? '✓' : '✗'} ${passedCount}/${results.length} — тесты Сада`;
};

export const run = () => {
  const results = registry.map(runOne);
  const passedCount = results.filter((result) => result.passed).length;

  results
    .filter((result) => !result.passed)
    .forEach(({ name, error }) => console.error(`✗ ${name}\n  ${error}`));
  console.log(`Тесты: пройдено ${passedCount} из ${results.length}`);

  if (typeof document !== 'undefined') renderResults(results, passedCount);
  return results;
};
