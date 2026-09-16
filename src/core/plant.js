/*
  Как выглядит дерево задачи и где оно стоит в саду.

  Math.random тут не подходит: после F5 деревья были бы уже другими.
  Поэтому берём хеш от id как seed и крутим от него простой ГПСЧ -
  один и тот же id всегда даёт одно и то же дерево.

  Здесь только числа, рисует всё это scene.js. Размеры примерно в метрах.
*/
import { scan, chunk } from './fp.js';

// FNV-1a, 32 бита. Math.imul нужен, чтобы умножение не уходило во float
export const hashString = (text) =>
  [...text].reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0, 2166136261);

// mulberry32, разбитый на два шага: step двигает состояние, toUnit превращает его в [0, 1)
const step = (state) => (state + 0x6d2b79f5) >>> 0;

const toUnit = (state) => {
  const a = Math.imul(state ^ (state >>> 15), state | 1);
  const b = (a + Math.imul(a ^ (a >>> 7), a | 61)) ^ a;
  return ((b ^ (b >>> 14)) >>> 0) / 4294967296;
};

// count псевдослучайных чисел от seed (состояния копит scan)
export const randomSequence = (seed, count) =>
  scan(step, step(seed), Array.from({ length: count - 1 })).map(toUnit);

const between = (unit, min, max) => Math.round((min + unit * (max - min)) * 1000) / 1000;
const pickFrom = (unit, list) => list[Math.floor(unit * list.length)];

export const SPECIES = ['oak', 'fir', 'apple', 'blossom', 'birch'];

export const SPECIES_NAMES = {
  oak: 'дуб',
  fir: 'ель',
  apple: 'яблоня',
  blossom: 'сакура',
  birch: 'берёза',
};

// --- дерево ---
// координаты кроны считаются от верхушки ствола

export const plantFor = (id) => {
  const r = randomSequence(hashString(String(id)), 64);
  const species = pickFrom(r[0], SPECIES);
  const scale = between(r[1], 0.85, 1.2);
  return {
    species,
    scale,
    yaw: between(r[2], 0, Math.PI * 2),
    leanX: between(r[3], -0.08, 0.08),            // чуть кривые деревья смотрятся живее
    leanZ: between(r[4], -0.08, 0.08),
    trunkHeight: species === 'birch' ? between(r[5], 1.5, 1.9) : between(r[5], 0.9, 1.25),
    // крона из 5 шаров
    crown: chunk(r.slice(6, 31), 5).map(([x, y, z, radius, tone]) => ({
      x: between(x, -0.45, 0.45),
      y: between(y, 0.1, 0.75),
      z: between(z, -0.45, 0.45),
      r: between(radius, 0.42, 0.62),
      tone: Math.floor(tone * 3),
    })),
    // яблоки / цветы сидят на поверхности какого-то шара кроны
    fruits: chunk(r.slice(31, 52), 3).map(([blob, theta, phi]) => ({
      blob: Math.floor(blob * 5),
      theta: between(theta, 0, Math.PI * 2),
      phi: between(phi, 0.3, 2.2),
    })),
    // для ели: 4 конуса снизу вверх
    tiers: r.slice(52, 56).map((unit, index) => ({
      y: 0.15 + index * 0.45,
      radius: between(unit, 0.75, 0.9) - index * 0.17,
      height: 0.9 - index * 0.08,
      tone: index % 3,
    })),
    // полоски на берёзе
    marks: chunk(r.slice(56, 64), 2).map(([y, angle]) => ({
      y: between(y, 0.2, 0.95),
      angle: between(angle, 0, Math.PI * 2),
    })),
  };
};

// --- расстановка ---

export const PLANT_SPACING = 1.55;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°

// Спираль с золотым углом, как семечки у подсолнуха: деревья не наезжают
// друг на друга и сад растёт более-менее ровным кругом
export const gardenSlot = (index) => {
  const radius = PLANT_SPACING * Math.sqrt(index + 0.5);
  const angle = index * GOLDEN_ANGLE;
  return { x: radius * Math.cos(angle), z: radius * Math.sin(angle) };
};

// нужен камере, чтобы понять, насколько отъехать
export const gardenRadius = (count) => PLANT_SPACING * Math.sqrt(Math.max(count, 1) + 0.5) + 1.5;

// трава, цветы, камни вокруг. seed фиксированный, так что лужайка всегда одна и та же
const DECOR_KINDS = ['grass', 'grass', 'grass', 'flower', 'flower', 'stone'];

export const gardenDecor = (count, seed = 20260916) =>
  chunk(randomSequence(seed, count * 5), 5).map(([kind, distance, angle, size, tone]) => ({
    kind: pickFrom(kind, DECOR_KINDS),
    x: between(distance, 1, 24) * Math.cos(angle * Math.PI * 2),
    z: between(distance, 1, 24) * Math.sin(angle * Math.PI * 2),
    size: between(size, 0.6, 1.4),
    tone: Math.floor(tone * 3),
  }));

// звёзды - единичные векторы, все выше горизонта
export const starField = (count, seed = 7) =>
  chunk(randomSequence(seed, count * 3), 3).map(([u, v, brightness]) => {
    const theta = u * Math.PI * 2;
    const y = 0.08 + v * 0.92;
    const ring = Math.sqrt(1 - y * y);
    return { x: ring * Math.cos(theta), y, z: ring * Math.sin(theta), brightness: between(brightness, 0.4, 1) };
  });
