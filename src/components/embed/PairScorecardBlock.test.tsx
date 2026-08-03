/**
 * Tarjetas individuales de la ficha de Parejas: filas Hoyo / Par / HCP / Golpes.
 * Comprueba que el HCP compartido se muestra también para jugadoras y que
 * los totales incompletos siguen mostrándose como "—".
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PairScorecardBlock from '@/components/embed/PairScorecardBlock';
import type { PairResultEntity } from '@/lib/buildPairsRanking';
import type { PairsRound } from '@/hooks/useCompetitionPairsRanking';

const PAR = [4, 5, 3, 5, 3, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5];
const HCP = [10, 14, 18, 4, 16, 6, 12, 8, 2, 1, 5, 11, 17, 7, 3, 15, 13, 9];
const S1 = [4, 5, 3, 8, 5, 5, 4, 6, 6, 4, 6, 4, 5, 5, 6, 3, 5, 6];
const S2 = [6, 5, 3, 6, 5, 5, 4, 5, 6, 6, 6, 5, 5, 5, 4, 4, 6, 5];

const round = {
  id: 'r4',
  label: 'J4',
  name: 'Jornada 4',
  date: '2026-07-12',
  isPublished: true,
  coursePar: PAR,
  courseHandicap: HCP,
  courseHandicapWomen: null,
} as unknown as PairsRound;

const makeResult = (scores1: (number | null)[]): PairResultEntity =>
  ({
    id: 'pr1',
    pairId: 'pair1',
    roundId: 'r4',
    position: 1,
    grossPoints: 24,
    netPoints: 40,
    pairHandicap: null,
    player1ExactHandicap: null,
    player2ExactHandicap: null,
    player1PlayingHandicap: 16,
    player2PlayingHandicap: 10,
    player1Scorecard: { scores: scores1 },
    player2Scorecard: { scores: S2 },
  }) as unknown as PairResultEntity;

const player1 = { id: 'p1', name: 'JUAREZ ESCOLANO, MERCEDES', gender: 'F', license: null } as never;
const player2 = { id: 'p2', name: 'OPORTO MENENDEZ, ALFREDO', gender: 'M', license: null } as never;

describe('PairScorecardBlock — filas Par y HCP', () => {
  it('muestra las filas Par y HCP en las dos tarjetas', () => {
    render(
      <PairScorecardBlock result={makeResult(S1)} round={round} player1={player1} player2={player2} />,
    );
    expect(screen.getAllByText('Par')).toHaveLength(2);
    expect(screen.getAllByText('HCP')).toHaveLength(2);
    // El índice del hoyo 3 (18) aparece en ambas tarjetas, también en la de la jugadora.
    expect(screen.getAllByText('18').length).toBeGreaterThanOrEqual(2);
  });

  it('mantiene los totales incompletos como "—"', () => {
    const incomplete = [...S1];
    incomplete[2] = null;
    const { container } = render(
      <PairScorecardBlock
        result={makeResult(incomplete)}
        round={round}
        player1={player1}
        player2={player2}
      />,
    );
    const strokeRow = container.querySelector('.pano-pairs-table__strokes')!;
    const cells = strokeRow.querySelectorAll('td');
    expect(cells[18].textContent).toBe('—'); // Ida
    expect(cells[19].textContent).not.toBe('—'); // Vuelta completa
    expect(cells[20].textContent).toBe('—'); // Total
  });
});
