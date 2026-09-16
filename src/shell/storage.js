// Обёртка над localStorage. Про задачи ничего не знает, просто JSON туда-обратно.
// try/catch везде: в приватном режиме или при переполнении localStorage кидает ошибку,
// а внутри может оказаться битый JSON (если испортить его в DevTools, приложение просто начнёт с нуля).

export const loadJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

// событие storage прилетает только в другие вкладки, не в ту, что записала
export const onExternalChange = (key, callback) => {
  window.addEventListener('storage', (event) => {
    if (event.key === key) callback(loadJson(key));
  });
};
