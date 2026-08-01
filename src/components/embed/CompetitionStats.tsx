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
  onPlayerClick?: (playerId: string) => void;
};

const NO_DATA = 'Sin datos suficientes';

const CompetitionStats = ({ results, rankings, bestN, onPlayerClick }: Props) => {
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
    if (!entries.length) return <p className="pano-embed__state">{NO_DATA}</p>;
    return (
      <ol className="pano-stats__list">
        {entries.map((e, i) => (
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
              <span className="pano-stats__unit">{suffix}</span>
            </span>
          </li>
        ))}
      </ol>
    );
  };

  const renderHoles = (holes: HoleStat[]) => {
    if (!holes.length) return <p className="pano-embed__state">{NO_DATA}</p>;
    return (
      <ul className="pano-stats__list">
        {holes.map((h) => (
          <li key={h.hole} className="pano-stats__row">
            <span className="pano-stats__pos">{String(h.hole).padStart(2, '0')}</span>
            <span className="pano-stats__player">
              <span className="pano-stats__holename">Hoyo {h.hole}</span>
              <span className="pano-stats__meta">Par {h.par || '—'}</span>
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
      return p ? { label, id: p.id, name: p.name, total: p.total, rounds: p.roundsPlayed } : { label, id: null };
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
      {/* 1. Resumen general */}
      <p className="pano-embed__caption">Resumen general</p>
      <div className="pano-stats__summary">
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

      {/* 2. Mejores vueltas */}
      <p className="pano-embed__caption">Mejores vueltas</p>
      <div className="pano-stats__cols">
        <div className="pano-stats__block">
          <h3 className="pano-stats__blocktitle">Stableford Hándicap</h3>
          {renderEntries(stats.bestHandicapRounds, 'pts')}
        </div>
        <div className="pano-stats__block">
          <h3 className="pano-stats__blocktitle">Scratch</h3>
          {renderEntries(stats.bestScratchRounds, 'pts')}
        </div>
      </div>

      {/* 3. Regularidad y Birdies */}
      <div className="pano-stats__cols">
        <div className="pano-stats__block">
          <p className="pano-embed__caption">Regularidad</p>
          <p className="pano-stats__note">Jugadores con un mínimo de 3 pruebas disputadas</p>
          {renderEntries(stats.regularity, 'pts', 1)}
        </div>
        <div className="pano-stats__block">
          <p className="pano-embed__caption">Birdies</p>
          <p className="pano-stats__note">Hoyos jugados en par menos uno</p>
          {renderEntries(stats.birdies, '')}
        </div>
      </div>

      {/* 4. Golpes destacados */}
      <p className="pano-embed__caption">Golpes destacados</p>
      <div className="pano-stats__inline">
        <div className="pano-stats__kpi pano-stats__kpi--small">
          <span className="pano-stats__figure">{special.holeInOne}</span>
          <span className="pano-stats__label">Hoyos en uno</span>
        </div>
        <div className="pano-stats__kpi pano-stats__kpi--small">
          <span className="pano-stats__figure">{special.albatross}</span>
          <span className="pano-stats__label">Albatros</span>
        </div>
        <div className="pano-stats__kpi pano-stats__kpi--small">
          <span className="pano-stats__figure">{special.eagles}</span>
          <span className="pano-stats__label">
            Eagles
            {special.topEagles && (
              <>
                {' · '}
                <PlayerName id={special.topEagles.playerId} name={special.topEagles.name} />
                {` (${special.topEagles.value})`}
              </>
            )}
          </span>
        </div>
      </div>

      {/* 5. El campo */}
      <p className="pano-embed__caption">El campo</p>
      <div className="pano-stats__cols">
        <div className="pano-stats__block">
          <h3 className="pano-stats__blocktitle">Hoyos más difíciles</h3>
          {renderHoles(stats.hardestHoles)}
        </div>
        <div className="pano-stats__block">
          <h3 className="pano-stats__blocktitle">Hoyos más fáciles</h3>
          {renderHoles(stats.easiestHoles)}
        </div>
      </div>
      <div className="pano-stats__inline">
        {stats.parAverages.map((p) => (
          <div key={p.par} className="pano-stats__kpi pano-stats__kpi--small">
            <span className="pano-stats__figure">{p.avg != null ? p.avg.toFixed(2) : '—'}</span>
            <span className="pano-stats__label">
              Media pares {p.par}
              {p.avg == null ? ` · ${NO_DATA}` : ''}
            </span>
          </div>
        ))}
      </div>

      {/* 6. Líderes actuales */}
      <p className="pano-embed__caption">Líderes actuales</p>
      <ul className="pano-stats__list">
        {leaders.map((l) => (
          <li key={l.label} className="pano-stats__row">
            <span className="pano-stats__pos pano-stats__pos--wide">{l.label}</span>
            <span className="pano-stats__player">
              {l.id ? (
                <>
                  <PlayerName id={l.id} name={l.name!} />
                  <span className="pano-stats__meta">
                    {l.rounds} {l.rounds === 1 ? 'prueba' : 'pruebas'}
                  </span>
                </>
              ) : (
                <span className="pano-stats__meta">{NO_DATA}</span>
              )}
            </span>
            <span className="pano-stats__value">
              {l.id ? l.total : '—'}
              <span className="pano-stats__unit">pts</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="pano-stats__note">
        Orden del mérito calculado con los mejores {bestN} resultados de la competición.
      </p>
    </div>
  );
};

export default CompetitionStats;
