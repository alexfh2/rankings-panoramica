/**
 * Sección ESTADÍSTICAS del Orden del Mérito de Parejas.
 * Componente puro: no ejecuta useQuery ni consulta Supabase.
 * Trabaja solo con los datos ya cargados por useCompetitionPairsRanking.
 * El Net oficial es la fuente de verdad; el Brt oficial es informativo.
 */
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computePairsCompetitionStats, type PairsStatsRound } from '@/lib/pairsCompetitionStats';
import type { PairResultEntity, PairsRankingOutput } from '@/lib/buildPairsRanking';
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';

type Props = {
  rounds: readonly PairsStatsRound[];
  pairResults: readonly PairResultEntity[];
  ranking: PairsRankingOutput;
  bestNScores: number;
  previewMode?: boolean;
  onPairClick?: (pairId: string) => void;
};

const NO_DATA = 'Sin datos suficientes';
const SERIES_COLORS = ['#B6945B', '#B97452', '#F3EEE3', '#8FA37E', '#C9B27C'];

const formatDate = (date: string | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const categoryLabel = (cat: 'hcp_low' | 'hcp_high') =>
  cat === 'hcp_low' ? '1ª Cat.' : '2ª Cat.';

const PairsCompetitionStats = ({
  rounds,
  pairResults,
  ranking,
  bestNScores,
  previewMode = false,
  onPairClick,
}: Props) => {
  const stats = useMemo(
    () => computePairsCompetitionStats({ rounds, pairResults, ranking, bestNScores }),
    [rounds, pairResults, ranking, bestNScores]
  );

  const evolutionPairs = useMemo(() => {
    const top = [...ranking.rankings.hcpLow, ...ranking.rankings.hcpHigh]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return top;
  }, [ranking]);

  const [activePairs, setActivePairs] = useState<string[] | null>(null);
  const selectedPairs = activePairs ?? evolutionPairs.map((p) => p.pairId);

  const chartData = useMemo(
    () =>
      ranking.columns.map((col) => {
        const point: Record<string, string | number | null> = { label: col.label };
        for (const pair of evolutionPairs) {
          point[pair.pairId] = pair.scoresByRoundId[col.id]?.netPoints ?? null;
        }
        return point;
      }),
    [ranking.columns, evolutionPairs]
  );

  const togglePair = (pairId: string) =>
    setActivePairs((prev) => {
      const base = prev ?? evolutionPairs.map((p) => p.pairId);
      return base.includes(pairId) ? base.filter((id) => id !== pairId) : [...base, pairId];
    });

  const PairName = ({ pairId, name }: { pairId: string; name: string }) => (
    <button
      type="button"
      className="pano-embed__namebtn pano-stats__name"
      title={name}
      aria-label={`Ver ficha de ${name}`}
      onClick={() => onPairClick?.(pairId)}
    >
      {name}
    </button>
  );

  if (!pairResults.length) {
    return <p className="pano-embed__state">No hay estadísticas disponibles todavía.</p>;
  }

  const { summary, leaders, bestNet, bestGross, regularity, roundPerformance, wins, podiums, discards, fourball } =
    stats;

  const hasFourball = fourball.validResults > 0;

  return (
    <div className="pano-stats pano-pairs-stats">
      {/* A. Resumen general */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Resumen general</h3>
        <div className="pano-stats__strip pano-stats__strip--4">
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.roundsCount}</span>
            <span className="pano-stats__label">
              {previewMode ? 'Pruebas (incluye borradores)' : 'Pruebas publicadas'}
            </span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.pairsCount}</span>
            <span className="pano-stats__label">Parejas participantes</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">{summary.resultsCount}</span>
            <span className="pano-stats__label">Resultados de pareja</span>
          </div>
          <div className="pano-stats__kpi">
            <span className="pano-stats__figure">
              {summary.avgNet != null ? summary.avgNet.toFixed(1) : '—'}
            </span>
            <span className="pano-stats__label">Media Net oficial</span>
            <span className="pano-stats__delta">
              {summary.avgGross != null
                ? `Media Brt ${summary.avgGross.toFixed(1)} · ${summary.grossSampleSize} tarjetas`
                : 'Media Brt no disponible'}
            </span>
          </div>
        </div>
      </section>

      {/* B. Líderes actuales */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Líderes actuales</h3>
        <div className="pano-stats__strip pano-stats__strip--2">
          {leaders.map((l) => (
            <div key={l.categoryLabel} className="pano-stats__leader">
              <span className="pano-stats__cat">{l.categoryLabel}</span>
              {l.row ? (
                <>
                  <PairName pairId={l.row.pairId} name={l.row.displayName} />
                  <span className="pano-stats__meta">
                    {`${l.countedResults} ${l.countedResults === 1 ? 'resultado cuenta' : 'resultados cuentan'}`}
                    {l.gap != null ? ` · ${l.gap === 0 ? 'Empatada con la 2ª' : `+${l.gap} sobre la 2ª`}` : ''}
                  </span>
                  <span className="pano-stats__value">
                    {l.row.total}
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
          Clasificación acumulada con los mejores {bestNScores} resultados Net oficiales.
        </p>
      </section>

      {/* C. Mejores vueltas Net y Brt */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Mejores vueltas</h3>
        <div className="pano-stats__cols">
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Net oficial</h4>
            {!bestNet.length ? (
              <p className="pano-embed__state">{NO_DATA}</p>
            ) : (
              <ol className="pano-stats__list">
                {bestNet.map((e, i) => (
                  <li key={e.resultId} className="pano-stats__row">
                    <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="pano-stats__player">
                      <PairName pairId={e.pairId} name={e.displayName} />
                      <span className="pano-stats__meta">
                        {[
                          `${e.roundLabel} · ${e.roundName}`,
                          formatDate(e.date),
                          categoryLabel(e.category),
                          e.position != null ? `Pos. ${e.position}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="pano-stats__value">
                      {e.netPoints}
                      <span className="pano-stats__unit">Net</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Brt oficial</h4>
            {!bestGross.length ? (
              <p className="pano-embed__state">Los archivos oficiales no incluyen resultados Brt.</p>
            ) : (
              <ol className="pano-stats__list">
                {bestGross.map((e, i) => (
                  <li key={e.resultId} className="pano-stats__row">
                    <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="pano-stats__player">
                      <PairName pairId={e.pairId} name={e.displayName} />
                      <span className="pano-stats__meta">
                        {`${e.roundLabel} · ${e.roundName} · Net ${e.netPoints}`}
                      </span>
                    </span>
                    <span className="pano-stats__value">
                      {e.grossPoints}
                      <span className="pano-stats__unit">Brt</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* D. Regularidad */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Regularidad</h3>
        <p className="pano-stats__note">
          Parejas con un mínimo de 3 pruebas · menor variación del Net oficial
        </p>
        {!regularity.length ? (
          <p className="pano-embed__state">
            La regularidad estará disponible cuando alguna pareja dispute tres pruebas.
          </p>
        ) : (
          <ol className="pano-stats__list">
            {regularity.map((e, i) => (
              <li key={e.pairId} className="pano-stats__row">
                <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
                <span className="pano-stats__player">
                  <PairName pairId={e.pairId} name={e.displayName} />
                  <span className="pano-stats__meta">
                    {`${e.roundsPlayed} pruebas · Media Net ${e.avgNet.toFixed(1)}`}
                  </span>
                </span>
                <span className="pano-stats__value">
                  {e.deviation.toFixed(2)}
                  <span className="pano-stats__unit">variación</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* E. Evolución */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Evolución</h3>
        <p className="pano-stats__note">Net oficial prueba a prueba de las cinco primeras parejas</p>
        {!evolutionPairs.length || !ranking.columns.length ? (
          <p className="pano-embed__state">{NO_DATA}</p>
        ) : (
          <>
            <div className="pano-pairs-stats__legend">
              {evolutionPairs.map((p, i) => {
                const on = selectedPairs.includes(p.pairId);
                return (
                  <button
                    key={p.pairId}
                    type="button"
                    className={`pano-pairs-stats__chip${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => togglePair(p.pairId)}
                  >
                    <span
                      className="pano-pairs-stats__dot"
                      style={{ background: on ? SERIES_COLORS[i % SERIES_COLORS.length] : 'transparent' }}
                    />
                    {p.displayName}
                  </button>
                );
              })}
            </div>
            <div className="pano-pairs-stats__chart">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke="rgba(243,238,227,0.10)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(243,238,227,0.45)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis stroke="rgba(243,238,227,0.45)" tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#202A21',
                      border: '1px solid rgba(243,238,227,0.15)',
                      color: '#F3EEE3',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} Net`,
                      evolutionPairs.find((p) => p.pairId === name)?.displayName ?? name,
                    ]}
                  />
                  {evolutionPairs
                    .filter((p) => selectedPairs.includes(p.pairId))
                    .map((p) => (
                      <Line
                        key={p.pairId}
                        type="monotone"
                        dataKey={p.pairId}
                        stroke={
                          SERIES_COLORS[
                            evolutionPairs.findIndex((x) => x.pairId === p.pairId) % SERIES_COLORS.length
                          ]
                        }
                        strokeWidth={1.6}
                        dot={{ r: 2.5 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* F. Rendimiento por prueba */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Rendimiento por prueba</h3>
        <ul className="pano-stats__list">
          {roundPerformance.map((r) => (
            <li key={r.roundId} className="pano-stats__row pano-pairs-stats__roundrow">
              <span className="pano-stats__pos">{r.label}</span>
              <span className="pano-stats__player">
                <span className="pano-stats__holename">
                  {r.name}
                  {previewMode && !r.isPublished && <span className="pano-pairs__tag">NO PUBLICADA</span>}
                </span>
                <span className="pano-stats__meta">
                  {[
                    formatDate(r.date),
                    `${r.pairsCount} parejas`,
                    r.bestNet != null ? `Mejor ${r.bestNet}` : null,
                    r.worstNet != null ? `Peor ${r.worstNet}` : null,
                    r.pctAtLeast36 != null
                      ? `${r.pctAtLeast36}% resultados de 36 puntos o más`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {r.winner && (
                  <span className="pano-stats__meta">
                    Ganadora: <PairName pairId={r.winner.pairId} name={r.winner.displayName} />
                  </span>
                )}
              </span>
              <span className="pano-stats__value">
                {r.avgNet != null ? r.avgNet.toFixed(1) : '—'}
                <span className="pano-stats__unit">Net medio</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* G. Victorias y podios */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Victorias y podios</h3>
        <p className="pano-stats__note">
          Calculado con la posición oficial de cada prueba incluida en esta vista
        </p>
        <div className="pano-stats__cols">
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Más victorias</h4>
            {!wins.length ? (
              <p className="pano-embed__state">{NO_DATA}</p>
            ) : (
              <ol className="pano-stats__list">
                {wins.map((e, i) => (
                  <li key={e.pairId} className="pano-stats__row">
                    <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="pano-stats__player">
                      <PairName pairId={e.pairId} name={e.displayName} />
                    </span>
                    <span className="pano-stats__value">{e.value}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="pano-stats__block">
            <h4 className="pano-stats__h2">Más podios</h4>
            {!podiums.length ? (
              <p className="pano-embed__state">{NO_DATA}</p>
            ) : (
              <ol className="pano-stats__list">
                {podiums.map((e, i) => (
                  <li key={e.pairId} className="pano-stats__row">
                    <span className="pano-stats__pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="pano-stats__player">
                      <PairName pairId={e.pairId} name={e.displayName} />
                    </span>
                    <span className="pano-stats__value">{e.value}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* H. Resultados descartados */}
      {discards && (
        <section className="pano-stats__section">
          <h3 className="pano-stats__h1">Resultados descartados</h3>
          <p className="pano-stats__note">
            Solo cuentan los mejores {bestNScores} resultados Net de cada pareja
          </p>
          <div className="pano-stats__strip pano-stats__strip--3">
            <div className="pano-stats__kpi">
              <span className="pano-stats__figure">{discards.totalDiscards}</span>
              <span className="pano-stats__label">Descartes totales</span>
              <span className="pano-stats__delta">{discards.pairsWithDiscards} parejas afectadas</span>
            </div>
            <div className="pano-stats__kpi">
              <span className="pano-stats__figure">{discards.bestDiscard?.netPoints ?? '—'}</span>
              <span className="pano-stats__label">Mejor descarte</span>
              {discards.bestDiscard && (
                <span className="pano-stats__delta">
                  <PairName
                    pairId={discards.bestDiscard.pairId}
                    name={discards.bestDiscard.displayName}
                  />
                  {` · ${discards.bestDiscard.roundLabel}`}
                </span>
              )}
            </div>
            <div className="pano-stats__kpi">
              <span className="pano-stats__figure">{discards.biggestGap?.difference ?? '—'}</span>
              <span className="pano-stats__label">Mayor diferencia descartada</span>
              {discards.biggestGap && (
                <span className="pano-stats__delta">
                  <PairName pairId={discards.biggestGap.pairId} name={discards.biggestGap.displayName} />
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* I. Análisis Fourball */}
      <section className="pano-stats__section">
        <h3 className="pano-stats__h1">Análisis Fourball</h3>
        {!hasFourball ? (
          <>
            <p className="pano-embed__state">
              Las estadísticas Fourball hoyo a hoyo estarán disponibles cuando los archivos incluyan el
              HPU individual de ambos jugadores y los datos completos del recorrido.
            </p>
            <p className="pano-stats__note">
              La clasificación y las estadísticas basadas en Net y Brt oficiales ya están disponibles.
            </p>
          </>
        ) : (
          <>
            <p className="pano-stats__note">
              Basado en {fourball.validResults} de {fourball.totalResults} resultados con HPU de ambos
              jugadores y recorrido completo.
            </p>
            <div className="pano-stats__strip pano-stats__strip--4">
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">
                  {fourball.pctPlayer1 != null ? `${fourball.pctPlayer1}%` : '—'}
                </span>
                <span className="pano-stats__label">Hoyos aportados por J1</span>
                <span className="pano-stats__delta">{fourball.holesPlayer1} hoyos</span>
              </div>
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">
                  {fourball.pctPlayer2 != null ? `${fourball.pctPlayer2}%` : '—'}
                </span>
                <span className="pano-stats__label">Hoyos aportados por J2</span>
                <span className="pano-stats__delta">{fourball.holesPlayer2} hoyos</span>
              </div>
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">
                  {fourball.pctTie != null ? `${fourball.pctTie}%` : '—'}
                </span>
                <span className="pano-stats__label">Empates</span>
                <span className="pano-stats__delta">{fourball.holesTie} hoyos</span>
              </div>
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">
                  {fourball.pctNone != null ? `${fourball.pctNone}%` : '—'}
                </span>
                <span className="pano-stats__label">Hoyos sin puntos</span>
                <span className="pano-stats__delta">{fourball.holesNone} hoyos</span>
              </div>
            </div>

            <div className="pano-stats__strip pano-stats__strip--2">
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">{fourball.netMatches}</span>
                <span className="pano-stats__label">Tarjetas coincidentes con el Net oficial</span>
              </div>
              <div className="pano-stats__kpi">
                <span className="pano-stats__figure">{fourball.netMismatches}</span>
                <span className="pano-stats__label">Discrepancias con el Net oficial</span>
                <span className="pano-stats__delta">Se conserva siempre el valor oficial</span>
              </div>
            </div>

            <h4 className="pano-stats__h2">Distribución de contribución a la tarjeta Fourball</h4>
            <ul className="pano-stats__list">
              {fourball.contributions.slice(0, 8).map((c) => (
                <li key={c.pairId} className="pano-stats__row">
                  <span className="pano-stats__player">
                    <PairName pairId={c.pairId} name={c.displayName} />
                    <span className="pano-stats__meta">
                      {`${formatPlayerDisplayName(c.player1Name)} ${c.pctPlayer1}% · ${formatPlayerDisplayName(
                        c.player2Name
                      )} ${c.pctPlayer2}% · Empates ${c.pctTie}%`}
                    </span>
                  </span>
                  <span className="pano-stats__value">
                    {c.validResults}
                    <span className="pano-stats__unit">tarjetas</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="pano-stats__cols">
              <div className="pano-stats__block">
                <h4 className="pano-stats__h2">Hoyos con menor media Fourball</h4>
                <ul className="pano-stats__list">
                  {fourball.lowestHoles.map((h) => (
                    <li key={h.hole} className="pano-stats__row">
                      <span className="pano-stats__player">
                        <span className="pano-stats__holename">Hoyo {h.hole}</span>
                        <span className="pano-stats__meta">{`Par ${h.par || '—'} · HCP ${h.holeHcp || '—'}`}</span>
                      </span>
                      <span className="pano-stats__value">
                        {h.avgNetPoints.toFixed(2)}
                        <span className="pano-stats__unit">pts</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pano-stats__block">
                <h4 className="pano-stats__h2">Hoyos con mayor media Fourball</h4>
                <ul className="pano-stats__list">
                  {fourball.highestHoles.map((h) => (
                    <li key={h.hole} className="pano-stats__row">
                      <span className="pano-stats__player">
                        <span className="pano-stats__holename">Hoyo {h.hole}</span>
                        <span className="pano-stats__meta">{`Par ${h.par || '—'} · HCP ${h.holeHcp || '—'}`}</span>
                      </span>
                      <span className="pano-stats__value">
                        {h.avgNetPoints.toFixed(2)}
                        <span className="pano-stats__unit">pts</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default PairsCompetitionStats;
