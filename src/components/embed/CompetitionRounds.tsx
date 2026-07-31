/**
 * Vista PRUEBAS del embed de Panorámica.
 * Componente puro: no ejecuta useQuery ni consulta el backend.
 * Reutiliza únicamente la ordenación y el cálculo Scratch ya validados.
 */
import { useMemo, useState } from 'react';
import { computeScratchStableford } from '@/lib/scratchStableford';
import type { PublicResult } from '@/lib/publicCircuitData';

export type EmbedRound = {
  id: string;
  name: string;
  round_number: number | null;
  date: string | null;
  status?: string | null;
};

type Props = {
  rounds: EmbedRound[];
  results: PublicResult[];
  categoryThreshold: number;
  /** Hándicap de la primera participación por jugador (mismo mapa que el ranking acumulado). */
  categoryHandicapMap: Map<string, number | null>;
  /** Obre la fitxa del jugador (opcional). */
  onPlayerClick?: (playerId: string) => void;
};


type CatKey = 'hcpLow' | 'hcpHigh' | 'scratch';

const CATS: { key: CatKey; label: string }[] = [
  { key: 'hcpLow', label: '1ª Categoría' },
  { key: 'hcpHigh', label: '2ª Categoría' },
  { key: 'scratch', label: 'Scratch' },
];

const getHcp = (r: PublicResult) => r.handicap_at_round ?? r.players_public?.current_handicap ?? null;

// Stableford handicap: empate → gana hcp más bajo (mismo criterio que la vista de jornadas)
const sortByPointsThenLowHcp = (a: PublicResult, b: PublicResult) => {
  const diff = (b.stableford_points ?? 0) - (a.stableford_points ?? 0);
  if (diff !== 0) return diff;
  return (getHcp(a) ?? Infinity) - (getHcp(b) ?? Infinity);
};

const formatDate = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

const CompetitionRounds = ({ rounds, results, categoryThreshold, categoryHandicapMap }: Props) => {
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [catByRound, setCatByRound] = useState<Record<string, CatKey>>({});

  // Agrupación de resultados por round_id a partir del array ya cargado.
  const resultsByRound = useMemo(() => {
    const map = new Map<string, PublicResult[]>();
    for (const r of results) {
      if (!map.has(r.round_id)) map.set(r.round_id, []);
      map.get(r.round_id)!.push(r);
    }
    return map;
  }, [results]);

  const orderedRounds = useMemo(
    () =>
      [...rounds].sort((a, b) => {
        const an = a.round_number ?? Number.MAX_SAFE_INTEGER;
        const bn = b.round_number ?? Number.MAX_SAFE_INTEGER;
        if (an !== bn) return an - bn;
        return (a.date ?? '').localeCompare(b.date ?? '');
      }),
    [rounds]
  );

  // Categoría FIJA: hándicap de la primera participación en la competición.
  const fixedCategory = (r: PublicResult): 'hcp_low' | 'hcp_high' | null => {
    const h = categoryHandicapMap.get(r.player_id) ?? getHcp(r);
    if (h == null) return null;
    return h <= categoryThreshold ? 'hcp_low' : 'hcp_high';
  };

  const categorize = (roundResults: PublicResult[]) => {
    const hcpLow = roundResults
      .filter((r) => fixedCategory(r) === 'hcp_low')
      .sort(sortByPointsThenLowHcp);

    const hcpHigh = roundResults
      .filter((r) => fixedCategory(r) === 'hcp_high')
      .sort(sortByPointsThenLowHcp);

    // Scratch: mismo cálculo y fallback que la vista existente. Empate → gana hcp más alto.
    const scratch = roundResults
      .map((r) => {
        let pts = computeScratchStableford(r.scorecard, r.rounds?.course_par);
        if (pts == null && r.scratch_score != null && r.scratch_score <= 50) pts = r.scratch_score;
        return { r, pts };
      })
      .filter((x) => x.pts != null)
      .sort((a, b) => {
        const diff = (b.pts ?? 0) - (a.pts ?? 0);
        if (diff !== 0) return diff;
        return (getHcp(b.r) ?? -Infinity) - (getHcp(a.r) ?? -Infinity);
      });

    return { hcpLow, hcpHigh, scratch };
  };

  if (!orderedRounds.length) {
    return <p className="pano-embed__state">Esta competición todavía no tiene pruebas programadas.</p>;
  }

  return (
    <div className="pano-rounds">
      {orderedRounds.map((round) => {
        const roundResults = resultsByRound.get(round.id) ?? [];
        const hasResults = roundResults.length > 0;
        const isOpen = openRound === round.id;
        const cat = catByRound[round.id] ?? 'hcpLow';
        const cats = isOpen && hasResults ? categorize(roundResults) : null;

        return (
          <div key={round.id} className="pano-rounds__item">
            <button
              type="button"
              className="pano-rounds__head"
              aria-expanded={isOpen}
              disabled={!hasResults}
              onClick={() => setOpenRound(isOpen ? null : round.id)}
            >
              <span className="pano-rounds__num">
                {round.round_number != null ? String(round.round_number).padStart(2, '0') : '—'}
              </span>
              <span className="pano-rounds__meta">
                <span className="pano-rounds__name">{round.name}</span>
                <span className="pano-rounds__sub">
                  {[
                    formatDate(round.date),
                    hasResults ? `${roundResults.length} participantes` : 'Sin resultados',
                    round.status === 'draft' ? 'Borrador' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {hasResults && <span className="pano-rounds__chev">{isOpen ? '−' : '+'}</span>}
            </button>

            {isOpen && cats && (
              <div className="pano-rounds__body">
                <div className="pano-embed__tabs" role="tablist" aria-label={`Categorías de ${round.name}`}>
                  {CATS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={cat === c.key}
                      className="pano-embed__tab"
                      onClick={() => setCatByRound((prev) => ({ ...prev, [round.id]: c.key }))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {cat === 'scratch' ? (
                  cats.scratch.length ? (
                    <ol className="pano-embed__list">
                      {cats.scratch.map((x, i) => (
                        <li key={x.r.id} className="pano-embed__row">
                          <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
                          <span className="pano-embed__name">{x.r.players_public?.name ?? '—'}</span>
                          <span className="pano-embed__points">{x.pts} pts</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="pano-embed__state">Sin clasificación Scratch en esta prueba.</p>
                  )
                ) : (cat === 'hcpLow' ? cats.hcpLow : cats.hcpHigh).length ? (
                  <ol className="pano-embed__list">
                    {(cat === 'hcpLow' ? cats.hcpLow : cats.hcpHigh).map((r, i) => (
                      <li key={r.id} className="pano-embed__row">
                        <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
                        <span className="pano-embed__name">{r.players_public?.name ?? '—'}</span>
                        {getHcp(r) != null && (
                          <span className="pano-embed__rounds">Hcp {Number(getHcp(r)).toFixed(1)}</span>
                        )}
                        <span className="pano-embed__points">{r.stableford_points ?? 0} pts</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="pano-embed__state">Sin jugadores en esta categoría.</p>
                )}
              </div>
            )}

            {!hasResults && <p className="pano-rounds__empty">Resultados todavía no publicados</p>}
          </div>
        );
      })}
    </div>
  );
};

export default CompetitionRounds;
