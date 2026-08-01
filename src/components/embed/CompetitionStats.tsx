/**
 * Vista ESTADÍSTICAS del embed de Panorámica.
 * Componente puro: no ejecuta useQuery, no consulta Supabase ni Edge Functions.
 * Todos los cálculos usan exclusivamente los datos ya filtrados de individual-2026.
 */
import { useMemo } from 'react';
import { computeCompetitionStats, type StatEntry, type HoleStat } from '@/lib/competitionStats';
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';
import type { PublicResult } from '@/lib/publicCircuitData';
import type { CompetitionRankings } from '@/hooks/useCompetitionIndividualRanking';

type Props = {
  results: PublicResult[];
  rankings: CompetitionRankings;
  bestN: number;
  /** Mostrar els blocs Scratch (Individual: true; Liga de Verano: false). */
  showScratch?: boolean;
  onPlayerClick?: (playerId: string) => void;
};

const NO_DATA = 'Sin datos suficientes';
const TOP = 5;

const CompetitionStats = ({ results, rankings, bestN, showScratch = true, onPlayerClick }: Props) => {

  const stats = useMemo(() => computeCompetitionStats(results), [results]);

  const PlayerName = ({ id, name }: { id: string; name: string }) => (
    <button
      type="button"
      className="pano-embed__namebtn pano-stats__name"
      title={name}
      aria-label={`Ver ficha de ${name}`}
      onClick={() => onPlayerClick?.(id)}
    >
      {formatPlayerDisplayName(name)}
    </button>
  );

  const renderEntries = (entries: StatEntry[], suffix: string, decimals = 0) => {
    const rows = entries.slice(0, TOP);
    if (!rows.length) return <p className="pano-embed__state">{NO_DATA}</p>;
    return (
      <ol className="pano-stats__list">
        {rows.map((e, i) => (
          <li key={`${e.playerId}-${i}`} className="pano-stats__row">
            <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
            <span className="pano-stats__player">
              <PlayerName id={e.playerId} name={e.name} />
              {(e.detail || e.extra) && (
                <span className="pano-stats__meta">
                  {[e.detail, e.extra].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <span className="pano-stats__value">
              {decimals ? e.value.toFixed(decimals) : e.value}
              {suffix && <span className="pano-stats__unit">{suffix}</span>}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  const renderHoles = (holes: HoleStat[]) => {
    const rows = holes.slice(0, 3);
    if (!rows.length) return <p className="pano-embed__state">{NO_DATA}</p>;
    return (
      <ul className="pano-stats__list">
        {rows.map((h, i) => (
          <li key={h.hole} className="pano-stats__row">
            <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
            <span className="pano-stats__player">
              <span className="pano-stats__holename">Hoyo {h.hole}</span>
              <span className="pano-stats__meta">
                {`Par ${h.par || '—'} · HCP ${h.holeHcp ?? '—'}`}
              </span>
            </span>
            <span className="pano-stats__value">
              {h.avgStrokes.toFixed(2)}
              <span className="pano-stats__unit">
                {h.avgOverPar >= 0 ? `+${h.avgOverPar.toFixed(2)}` : h.avgOverPar.toFixed(2)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const leaders = useMemo(() => {
    const pick = (label: string, list: CompetitionRankings[keyof CompetitionRankings]) => {
      const p = list[0];
      return p
        ? { label, id: p.id as string | null, name: p.name, total: p.total, rounds: p.roundsPlayed }
        : { label, id: null as string | null };
    };
    return [
      pick('1ª Categoría', rankings.hcpLow),
      pick('2ª Categoría', rankings.hcpHigh),
      pick('Scratch', rankings.scratch),
    ];
  }, [rankings]);

  if (!results.length) {
    return <p className="pano-embed__state">Todavía no hay resultados publicados.</p>;
  }

  const { summary, special } = stats;

  return (
    <div className="pano-stats">
      {/* A. Resumen general */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Resumen general</h3>
        <div className="pano-stats__strip pano-stats__strip--4">
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.roundsPlayed}</span>
            <span className="pano-stats__label">Pruebas disputadas</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.playersCount}</span>
            <span className="pano-stats__label">Jugadores</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.cardsCount}</span>
            <span className="pano-stats__label">Tarjetas</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">
              {summary.avgStableford != null ? summary.avgStableford.toFixed(1) : '—'}
            </span>
            <span className="pano-stats__label">Media Stableford</span>
          </div>
        </div>
      </section>

      {/* B. Líderes actuales */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Líderes actuales</h3>
        <div className="pano-stats__strip pano-stats__strip--3">
          {leaders.map((l) => (
            <div key={l.label} className="pano-stats__leader">
              <span className="pano-stats__cat">{l.label}</span>
              {l.id ? (
                <>
                  <PlayerName id={l.id} name={l.name!} />
                  <span className="pano-stats__meta">
                    {l.rounds} {l.rounds === 1 ? 'prueba' : 'pruebas'}
                  </span>
                  <span className="pano-stats__value">
                    {l.total}
                    <span className="pano-stats__unit">pts</span>
                  </span>
                </>
              ) : (
                <span className="pano-stats__meta">{NO_DATA}</span>
              )}
            </div>
          ))}
        </div>
        <p className="pano-stats__note">
          Orden del mérito calculado con los mejores {bestN} resultados de la competición.
        </p>
      </section>

      {/* C. Mejores vueltas */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Mejores vueltas</h3>
        <div className="pano-stats__cols">
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Stableford Hándicap</h4>
            {renderEntries(stats.bestHandicapRounds, 'pts')}
          </div>
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Scratch</h4>
            {renderEntries(stats.bestScratchRounds, 'pts')}
          </div>
        </div>
      </section>

      {/* D. Regularidad y Birdies */}
      <section className="pano-stats__section">
        <div className="pano-stats__cols">
          <div className="pano-stats__block">
            <h3 className="pano-stats__h1">Regularidad</h3>
            <p className="pano-stats__note">Jugadores con un mínimo de 3 pruebas disputadas</p>
            {renderEntries(stats.regularity, 'pts', 1)}
          </div>
          <div className="pano-stats__block">
            <h3 className="pano-stats__h1">Birdies</h3>
            <p className="pano-stats__note">Total de birdies en las pruebas disputadas</p>
            {renderEntries(stats.birdies, '')}
          </div>
        </div>
      </section>

      {/* E. Golpes destacados */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Golpes destacados</h3>
        <div className="pano-stats__strip pano-stats__strip--3">
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{special.holeInOne}</span>
            <span className="pano-stats__label">Hoyos en uno</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{special.albatross}</span>
            <span className="pano-stats__label">Albatros</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{special.eagles}</span>
            <span className="pano-stats__label">Eagles</span>
            {special.topEagles && (
              <span className="pano-stats__meta">
                <PlayerName id={special.topEagles.playerId} name={special.topEagles.name} />
                {` (${special.topEagles.value})`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* F. El campo */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">El campo</h3>
        <p className="pano-stats__note">
          El HCP indica la dificultad teórica del hoyo; la media refleja el rendimiento registrado
          en las pruebas disputadas.
        </p>
        <div className="pano-stats__cols">
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Hoyos más difíciles</h4>
            {renderHoles(stats.hardestHoles)}
          </div>
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Hoyos más fáciles</h4>
            {renderHoles(stats.easiestHoles)}
          </div>
        </div>

        <h3 className="pano-stats__h1">Rendimiento por tipo de hoyo</h3>
        <div className="pano-stats__strip pano-stats__strip--3">
          {stats.parAverages.map((p) => (
            <div key={p.par} className="pano-stats__kpi">
              <span className="pano-stats__figure">{p.avg != null ? p.avg.toFixed(2) : '—'}</span>
              <span className="pano-stats__label">Media pares {p.par}</span>
              <span className="pano-stats__delta">
                {p.avg != null
                  ? `${p.avg - p.par >= 0 ? '+' : ''}${(p.avg - p.par).toFixed(2)} sobre par`
                  : NO_DATA}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CompetitionStats;
