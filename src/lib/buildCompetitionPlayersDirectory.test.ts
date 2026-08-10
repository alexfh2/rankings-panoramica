import { describe, it, expect } from 'vitest';
import {
  buildCompetitionPlayersDirectory,
  buildLatestCompetitionHandicapMap,
  formatHandicapSuffix,
  type DirectoryResultLike,
  type DirectoryRoundLike,
} from '@/lib/buildCompetitionPlayersDirectory';

const round = (id: string, date: string | null, n: number | null): DirectoryRoundLike => ({
  id,
  date,
  round_number: n,
});

const res = (
  roundId: string,
  playerId: string,
  name: string,
  handicapAtRound: number | null,
  current: number | null = null
): DirectoryResultLike => ({
  round_id: roundId,
  player_id: playerId,
  handicap_at_round: handicapAtRound,
  players_public: { id: playerId, name, current_handicap: current },
});

describe('buildLatestCompetitionHandicapMap', () => {
  const rounds = [round('r1', '2026-04-25', 1), round('r2', '2026-07-12', 2)];

  it('usa el handicap_at_round de la participación más reciente', () => {
    const map = buildLatestCompetitionHandicapMap({
      rounds,
      results: [
        res('r1', 'p1', 'ALVAREZ SOLER, ENRIQUE', 15.2, 9.9),
        res('r2', 'p1', 'ALVAREZ SOLER, ENRIQUE', 14.1, 9.9),
      ],
    });
    expect(map.get('p1')).toBe(14.1);
  });

  it('desempata por round_number y luego por id cuando la fecha coincide', () => {
    const sameDate = [round('rA', '2026-05-01', 2), round('rB', '2026-05-01', 1)];
    const byNumber = buildLatestCompetitionHandicapMap({
      rounds: sameDate,
      results: [res('rA', 'p1', 'X, Y', 10), res('rB', 'p1', 'X, Y', 20)],
    });
    expect(byNumber.get('p1')).toBe(10);

    const tie = [round('r-a', '2026-05-01', 1), round('r-b', '2026-05-01', 1)];
    const byId = buildLatestCompetitionHandicapMap({
      rounds: tie,
      results: [res('r-a', 'p1', 'X, Y', 10), res('r-b', 'p1', 'X, Y', 20)],
    });
    expect(byId.get('p1')).toBe(20);
  });

  it('conserva hándicaps negativos', () => {
    const map = buildLatestCompetitionHandicapMap({
      rounds,
      results: [res('r2', 'p2', 'MAS PITARCH, ISABEL', -3.2, 1)],
    });
    expect(map.get('p2')).toBe(-3.2);
  });

  it('solo usa current_handicap como fallback si no hay ningún snapshot', () => {
    const map = buildLatestCompetitionHandicapMap({
      rounds,
      results: [res('r1', 'p3', 'SIN, SNAPSHOT', null, 22.4)],
    });
    expect(map.get('p3')).toBe(22.4);

    const withSnapshot = buildLatestCompetitionHandicapMap({
      rounds,
      results: [res('r1', 'p3', 'CON, SNAPSHOT', 18.6, 22.4)],
    });
    expect(withSnapshot.get('p3')).toBe(18.6);
  });

  it('ignora resultados de jornadas no visibles (p. ej. draft no publicada)', () => {
    const map = buildLatestCompetitionHandicapMap({
      rounds, // r3 no está entre las jornadas visibles
      results: [
        res('r2', 'p1', 'ALVAREZ SOLER, ENRIQUE', 14.1),
        res('r3', 'p1', 'ALVAREZ SOLER, ENRIQUE', 12.0),
      ],
    });
    expect(map.get('p1')).toBe(14.1);
  });

  it('no mezcla competiciones: cada set de jornadas/resultados da su propio valor', () => {
    const individual = buildLatestCompetitionHandicapMap({
      rounds: [round('i1', '2026-03-01', 1)],
      results: [res('i1', 'p1', 'ALVAREZ SOLER, ENRIQUE', 12.4)],
    });
    const verano = buildLatestCompetitionHandicapMap({
      rounds: [round('v1', '2026-07-01', 1)],
      results: [res('v1', 'p1', 'ALVAREZ SOLER, ENRIQUE', 11.8)],
    });
    expect(individual.get('p1')).toBe(12.4);
    expect(verano.get('p1')).toBe(11.8);
  });

  it('devuelve el mismo valor que el directorio de JUGADORES', () => {
    const input = {
      rounds,
      results: [
        res('r1', 'p1', 'ALVAREZ SOLER, ENRIQUE', 15.2, 9.9),
        res('r2', 'p1', 'ALVAREZ SOLER, ENRIQUE', 14.1, 9.9),
        res('r1', 'p3', 'SIN, SNAPSHOT', null, 22.4),
      ],
    };
    const map = buildLatestCompetitionHandicapMap(input);
    for (const entry of buildCompetitionPlayersDirectory(input)) {
      expect(entry.lastHandicap).toBe(map.get(entry.playerId) ?? null);
    }
  });
});

describe('formatHandicapSuffix', () => {
  it('formatea con un decimal y coma', () => {
    expect(formatHandicapSuffix(14.1)).toBe('(HCP 14,1)');
    expect(formatHandicapSuffix(-3.2)).toBe('(HCP -3,2)');
    expect(formatHandicapSuffix(12)).toBe('(HCP 12,0)');
  });

  it('muestra guion largo cuando no hay valor', () => {
    expect(formatHandicapSuffix(null)).toBe('(HCP —)');
    expect(formatHandicapSuffix(undefined)).toBe('(HCP —)');
  });
});
