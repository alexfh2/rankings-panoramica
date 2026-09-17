import { describe, it, expect } from 'vitest';
import {
  buildIndividualNewsRankingCategories,
  buildPairsNewsRankingCategories,
  formatNewsRankingBlock,
} from './buildNewsRankingBlock';

const player = (name: string, total: number) => ({ name, total });

describe('buildNewsRankingBlock', () => {
  it('respeta el orden recibido y recorta al top 3', () => {
    const cats = buildIndividualNewsRankingCategories({
      hcpLow: [player('SANZ, MARIO', 210), player('LOPEZ, ANA', 205), player('RUIZ, LUIS', 200), player('X, Y', 190)],
      hcpHigh: [],
      scratch: [],
    });
    expect(cats).toHaveLength(1);
    expect(cats[0].label).toBe('HÁNDICAP BAJO');
    expect(cats[0].entries.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(cats[0].entries[0].name).toBe('Mario Sanz');
    expect(cats[0].entries[0].total).toBe(210);
  });

  it('omite categorías vacías', () => {
    const cats = buildIndividualNewsRankingCategories({ hcpLow: [], hcpHigh: [], scratch: [player('A, B', 10)] });
    expect(cats.map((c) => c.label)).toEqual(['SCRATCH']);
  });

  it('trata la pareja como unidad competitiva', () => {
    const cats = buildPairsNewsRankingCategories({
      hcpLow: [{ displayName: 'Ana Ruiz / Luis Paz', total: 120 }],
      hcpHigh: [],
    });
    expect(cats[0].label).toBe('PAREJAS HÁNDICAP BAJO');
    expect(cats[0].entries[0].name).toBe('Ana Ruiz / Luis Paz');
  });

  it('marca la clasificación como provisional durante la temporada', () => {
    const block = formatNewsRankingBlock({
      isFinalRound: false,
      includesThisRound: true,
      categories: [{ label: 'HÁNDICAP BAJO', entries: [{ position: 1, name: 'Mario Sanz', total: 210 }] }],
    });
    expect(block).toContain('PROVISIONAL DESPUÉS DE ESTA JORNADA');
    expect(block).toContain('1. Mario Sanz — 210 puntos');
  });

  it('marca la clasificación como final en la última prueba', () => {
    const block = formatNewsRankingBlock({
      isFinalRound: true,
      includesThisRound: true,
      categories: [{ label: 'HÁNDICAP ALTO', entries: [{ position: 1, name: 'Ana Ruiz', total: 190 }] }],
    });
    expect(block).toContain('FINAL');
    expect(block).not.toContain('PROVISIONAL');
  });

  it('avisa cuando la general aún no incluye esta jornada', () => {
    const block = formatNewsRankingBlock({
      isFinalRound: false,
      includesThisRound: false,
      categories: [{ label: 'SCRATCH', entries: [{ position: 1, name: 'Luis Paz', total: 90 }] }],
    });
    expect(block).toContain('NO incluye todavía los resultados de esta jornada');
  });

  it('devuelve texto explícito sin categorías', () => {
    expect(formatNewsRankingBlock({ isFinalRound: false, includesThisRound: true, categories: [] })).toBe(
      'No hay datos de clasificación general disponibles.'
    );
  });
});
