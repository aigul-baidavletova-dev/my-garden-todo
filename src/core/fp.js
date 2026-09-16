// Небольшой набор ФП-хелперов. Тащить Ramda ради десятка функций не хочется,
// да и полезно понимать, как они устроены внутри.

// pipe(f, g, h)(x) === h(g(f(x)))
export const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

// то же, но справа налево: compose(f, g, h)(x) === f(g(h(x)))
export const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);

// isActive = not(isDone)
export const not = (predicate) => (...args) => !predicate(...args);

// tasks.map(prop('title'))
export const prop = (key) => (obj) => obj[key];

// tasks.find(propEq('id', id))
export const propEq = (key, value) => (obj) => obj[key] === value;

// always(true) - для фильтра "Все" и пустого поиска
export const always = (value) => () => value;

export const allPass = (...predicates) => (x) => predicates.every((p) => p(x));
export const anyPass = (...predicates) => (x) => predicates.some((p) => p(x));

// f(a, b, c) можно звать как f(a)(b)(c) или f(a, b)(c)
export const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length ? fn(...args) : (...more) => curried(...args, ...more);
  return curried;
};

export const last = (arr) => arr[arr.length - 1];

// chunk([1, 2, 3, 4, 5], 2) -> [[1, 2], [3, 4], [5]]
export const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

// reduce, который отдаёт все промежуточные значения
// scan((a, b) => a + b, 0, [1, 2, 3]) -> [0, 1, 3, 6]
export const scan = (fn, initial, items) =>
  items.reduce((acc, item) => [...acc, fn(last(acc), item)], [initial]);

// Замораживаем состояние целиком (только на localhost), чтобы случайная мутация
// сразу падала с TypeError. Замороженное пропускаем - новые состояния
// переиспользуют куски старых, незачем обходить их повторно.
export const deepFreeze = (obj) => {
  Object.values(obj)
    .filter((value) => typeof value === 'object' && value !== null && !Object.isFrozen(value))
    .forEach(deepFreeze);
  return Object.freeze(obj);
};
