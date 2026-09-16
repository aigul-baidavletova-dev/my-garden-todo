// Время суток. Час передаётся снаружи (из main.js), сам модуль new Date() не трогает -
// так его можно спокойно тестировать в любое время, хоть ночь проверять днём.

export const PHASES = ['morning', 'evening', 'night'];
export const CHOICES = ['auto', ...PHASES];

export const PHASE_NAMES = { morning: 'Утро', evening: 'Вечер', night: 'Ночь' };

// утро 5-17, вечер 17-22, остальное ночь
export const phaseOfHour = (hour) => {
  if (hour >= 5 && hour < 17) return 'morning';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

export const isChoice = (value) => CHOICES.includes(value);

// если выбрано 'auto' (или мусор) - считаем по часам
export const resolvePhase = (choice, hour) => (choice === 'auto' || !isChoice(choice) ? phaseOfHour(hour) : choice);

// цвета для 3D-сцены, подбирались на глаз
export const SCENE_PALETTES = {
  morning: {
    skyTop: '#5fa8dc',
    skyBottom: '#fde6c4',
    fog: '#e3ecd8',
    ground: '#78ad55',
    hemiSky: '#d6ecff',
    hemiGround: '#5f8a42',
    hemiIntensity: 1.5,
    light: '#fff1d6',
    lightIntensity: 2.6,
    lightDirection: { x: 0.55, y: 1, z: 0.35 },
    disk: '#fff4cf',
    stars: 0,
    fireflies: 0,
  },
  evening: {
    skyTop: '#343377',
    skyBottom: '#f39462',
    fog: '#c98b7c',
    ground: '#5f8f48',
    hemiSky: '#ffc2a0',
    hemiGround: '#40562f',
    hemiIntensity: 1.25,
    light: '#ff9a55',
    lightIntensity: 1.8,
    lightDirection: { x: -0.85, y: 0.28, z: -0.25 },
    disk: '#ffb36e',
    stars: 0.35,
    fireflies: 0.6,
  },
  night: {
    skyTop: '#040812',
    skyBottom: '#1a2b4c',
    fog: '#101a2e',
    ground: '#26402b',
    hemiSky: '#6f8fd0',
    hemiGround: '#141f16',
    hemiIntensity: 0.6,
    light: '#b3c9ff',
    lightIntensity: 0.9,
    lightDirection: { x: -0.35, y: 0.9, z: 0.45 },
    disk: '#eef3ff',
    stars: 1,
    fireflies: 1,
  },
};
