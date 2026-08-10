import { describe, it, expect } from 'vitest';
import { calcExtraStrokes, calcStablefordPoints, calcScratchStablefordPoints } from '@/lib/stableford';

const INDICES = Array.from({ length: 18 }, (_, i) => i + 1);
const distribution = (hpu: number) => INDICES.map(si => calcExtraStrokes(si, hpu));
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

describe('calcExtraStrokes — distribución simétrica de HPU', () => {
  it.each([0, 2, 18, 20, -2, -3, -18, -20])('la suma de los 18 hoyos es exactamente el HPU (%i)', hpu => {
    expect(sum(distribution(hpu))).toBe(hpu);
  });

  it('HPU 0 → ningún hoyo recibe golpes', () => {
    expect(distribution(0)).toEqual(new Array(18).fill(0));
  });

  it('HPU +2 → +1 en HCP 1 y 2', () => {
    const d = distribution(2);
    expect(d.filter(v => v === 1)).toHaveLength(2);
    expect([d[0], d[1], d[2]]).toEqual([1, 1, 0]);
  });

  it('HPU +18 → +1 en todos los hoyos', () => {
    expect(distribution(18)).toEqual(new Array(18).fill(1));
  });

  it('HPU +20 → +1 en todos y +1 extra en HCP 1 y 2', () => {
    const d = distribution(20);
    expect([d[0], d[1], d[2]]).toEqual([2, 2, 1]);
  });

  it('HPU -2 → -1 solo en HCP 17 y 18', () => {
    const d = distribution(-2);
    expect(d.slice(0, 16)).toEqual(new Array(16).fill(0));
    expect([d[16], d[17]]).toEqual([-1, -1]);
  });

  it('HPU -3 → -1 solo en HCP 16, 17 y 18', () => {
    const d = distribution(-3);
    expect(d.slice(0, 15)).toEqual(new Array(15).fill(0));
    expect([d[15], d[16], d[17]]).toEqual([-1, -1, -1]);
  });

  it('HPU -18 → -1 en todos los hoyos', () => {
    expect(distribution(-18)).toEqual(new Array(18).fill(-1));
  });

  it('HPU -20 → -1 en todos y -1 extra en HCP 17 y 18', () => {
    const d = distribution(-20);
    expect(d.slice(0, 16)).toEqual(new Array(16).fill(-1));
    expect([d[16], d[17]]).toEqual([-2, -2]);
  });

  it('redondea el hándicap exacto negativo al entero más próximo', () => {
    expect(distribution(-3.2)).toEqual(distribution(-3));
    expect(distribution(-1.6)).toEqual(distribution(-2));
  });
});

describe('puntos por hoyo y scratch (sin cambios)', () => {
  it('el par con golpe recibido da 3 puntos y sin golpe 2', () => {
    expect(calcStablefordPoints(4, 4, 1, 18)).toBe(3);
    expect(calcStablefordPoints(4, 4, 1, 0)).toBe(2);
  });

  it('un HPU negativo entrega golpe en el hoyo de índice alto', () => {
    expect(calcStablefordPoints(4, 4, 18, -3)).toBe(1);
    expect(calcStablefordPoints(4, 4, 1, -3)).toBe(2);
  });

  it('scratch no aplica HPU', () => {
    expect(calcScratchStablefordPoints(4, 4)).toBe(2);
    expect(calcScratchStablefordPoints(3, 4)).toBe(3);
  });

  it('bola levantada devuelve null', () => {
    expect(calcStablefordPoints(0, 4, 1, -3)).toBeNull();
    expect(calcScratchStablefordPoints(0, 4)).toBeNull();
  });
});
