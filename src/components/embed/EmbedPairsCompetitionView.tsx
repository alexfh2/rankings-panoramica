/**
 * Vista compartida del Orden del Mérito de Parejas (pública y preview admin).
 * Solo lectura. El Net oficial de pair_results alimenta siempre la clasificación.
 */
import { useMemo, useRef, useState } from 'react';
import { usePanoramicaEmbedHeight } from '@/hooks/usePanoramicaEmbedHeight';
import { usePanoramicaEmbedScrollBridge } from '@/hooks/usePanoramicaEmbedScrollBridge';
import { usePanoramicaParentViewport } from '@/hooks/usePanoramicaParentViewport';
import { useCompetitionPairsRanking } from '@/hooks/useCompetitionPairsRanking';
import PairProfileDialog from '@/components/embed/PairProfileDialog';
import PairScorecardBlock from '@/components/embed/PairScorecardBlock';
import PairsCompetitionStats from '@/components/embed/PairsCompetitionStats';
import type { PairRankingRow } from '@/lib/buildPairsRanking';
import '@/styles/embed-panoramica.css';
import '@/styles/embed-pairs.css';
import '@/styles/embed-dialog.css';

type SectionKey = 'ranking' | 'rounds' | 'stats';
type TabKey = 'hcpLow' | 'hcpHigh';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'ranking', label: 'Clasificación' },
  { key: 'rounds', label: 'Pruebas' },
  { key: 'stats', label: 'Estadísticas' },
];


const TABS: { key: TabKey; label: string }[] = [
  { key: 'hcpLow', label: '1ª Categoría' },
  { key: 'hcpHigh', label: '2ª Categoría' },
];

const formatDate = (date: string | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

export type EmbedPairsCompetitionViewProps = {
  competitionSlug: string;
  includeUnpublished?: boolean;
  previewMode?: boolean;
};

const EmbedPairsCompetitionView = ({
  competitionSlug,
  includeUnpublished = false,
  previewMode = false,
}: EmbedPairsCompetitionViewProps) => {
  const {
    rounds,
    roundsById,
    pairResults,
    ranking,
    bestNScores,
    isLoading,
    error,
    competitionNotFound,
  } = useCompetitionPairsRanking(competitionSlug, includeUnpublished);

  const [section, setSection] = useState<SectionKey>('ranking');
  const [tab, setTab] = useState<TabKey>('hcpLow');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const embedRootRef = useRef<HTMLDivElement>(null);
  usePanoramicaEmbedHeight(embedRootRef);
  usePanoramicaParentViewport();
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<string | null>(null);

  const columns = ranking.columns;
  const gridStyle = { '--pano-round-count': columns.length || 1 } as React.CSSProperties;

  const selectedRow = selectedPairId ? ranking.rowsByPairId.get(selectedPairId) ?? null : null;

  const resultsByRound = useMemo(() => {
    const map = new Map<string, typeof pairResults>();
    for (const r of pairResults) {
      const list = map.get(r.roundId);
      if (list) list.push(r);
      else map.set(r.roundId, [r]);
    }
    return map;
  }, [pairResults]);

  const state = (msg: string) => <p className="pano-embed__state">{msg}</p>;

  /** Hcp inicial de la pareja (pairs.initial_pair_handicap), un decimal y coma decimal. */
  const formatPairHcp = (value: number | null): string | null =>
    value == null ? null : `HCP ${value.toFixed(1).replace('.', ',')}`;

  const nameButton = (row: PairRankingRow | undefined, fallback: string) =>
    row ? (
      <button
        type="button"
        className="pano-embed__name pano-embed__namebtn"
        title={row.displayName}
        aria-label={`Ver ficha de ${row.displayName}`}
        onClick={() => setSelectedPairId(row.pairId)}
      >
        {row.displayName}
      </button>
    ) : (
      <span className="pano-embed__name">{fallback}</span>
    );

  const renderRankingHead = () => (
    <div className="pano-pairs-ranking__line pano-pairs-ranking__head" style={gridStyle}>
      <span className="pano-embed__pos" aria-hidden="true" />
      <span className="pano-embed__name" aria-hidden="true" />
      <span className="pano-pairs-ranking__grid">
        {columns.map((c) => (
          <span
            key={c.id}
            className="pano-matrix__label"
            title={`${c.label} · ${c.name} · ${formatDate(c.date)}${previewMode ? ` · ${c.status ?? ''}` : ''}`}
          >
            {c.label}
          </span>
        ))}
      </span>
      <span className="pano-embed__points">Total</span>
    </div>
  );


  const renderRanking = () => {
    const list = ranking.rankings[tab];
    const activeLabel = TABS.find((t) => t.key === tab)?.label ?? '';

    return (
      <>
        <div className="pano-embed__tabs" role="tablist" aria-label="Categorías de la clasificación">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="pano-embed__tab"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="pano-embed__caption">
          Clasificación acumulada · Mejores {bestNScores} resultados — {activeLabel}
        </p>

        {!columns.length ? (
          state('Los resultados se publicarán después de la validación de cada prueba.')
        ) : !list.length ? (
          state('Todavía no hay parejas clasificadas en esta categoría.')
        ) : (
          <>
            {renderRankingHead()}
            <ol className="pano-embed__list">
              {list.map((row, i) => (
                <li
                  key={row.pairId}
                  className="pano-embed__row pano-pairs-ranking__line pano-pairs-ranking__row"
                  style={gridStyle}
                >
                  <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pano-embed__name pano-pairs-ranking__pair">
                    <button
                      type="button"
                      className="pano-pairs-ranking__pairbtn"
                      title={row.displayName}
                      aria-label={`Ver ficha de ${row.displayName}`}
                      onClick={() => setSelectedPairId(row.pairId)}
                    >
                      {row.displayName}
                    </button>
                    {formatPairHcp(row.initialPairHandicap) && (
                      <span className="pano-pairs-ranking__pairhcp">
                        ({formatPairHcp(row.initialPairHandicap)})
                      </span>
                    )}
                  </span>

                  <span className="pano-pairs-ranking__grid">
                    {columns.map((c) => {
                      const score = row.scoresByRoundId[c.id];
                      if (!score) {
                        return (
                          <span key={c.id} className="pano-matrix__cell pano-matrix__cell--empty">
                            —
                          </span>
                        );
                      }
                      return (
                        <span
                          key={c.id}
                          className={`pano-matrix__cell${score.counted ? '' : ' pano-matrix__cell--discarded'}`}
                          title={score.counted ? undefined : 'Resultado descartado'}
                        >
                          {score.netPoints}
                        </span>
                      );
                    })}
                  </span>
                  <span className="pano-embed__points">
                    <strong className="pano-matrix__total">{row.total}</strong>
                    <span className="pano-matrix__unit">pts</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </>
    );
  };

  const renderRounds = () => {
    if (!columns.length) {
      return state('Los resultados se publicarán después de la validación de cada prueba.');
    }
    return (
      <div className="pano-rounds">
        {columns.map((round) => {
          const results = [...(resultsByRound.get(round.id) ?? [])].sort((a, b) => {
            const ap = a.position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.position ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
            const ak = ranking.rowsByPairId.get(a.pairId)?.pairKey ?? '';
            const bk = ranking.rowsByPairId.get(b.pairId)?.pairKey ?? '';
            return ak.localeCompare(bk);
          });
          const isOpen = openRound === round.id;
          const avgNet = results.length
            ? Math.round((results.reduce((s, r) => s + r.netPoints, 0) / results.length) * 10) / 10
            : null;

          return (
            <div key={round.id} className="pano-rounds__item">
              <button
                type="button"
                className="pano-rounds__head"
                aria-expanded={isOpen}
                disabled={!results.length}
                onClick={() => setOpenRound(isOpen ? null : round.id)}
              >
                <span className="pano-rounds__num">{round.label}</span>
                <span className="pano-rounds__meta">
                  <span className="pano-rounds__name">
                    {round.name}
                    {previewMode && (
                      <span className="pano-pairs__tag">
                        {round.isPublished ? round.status : `${round.status} · NO PUBLICADA`}
                      </span>
                    )}
                  </span>
                  <span className="pano-rounds__sub">
                    {[
                      formatDate(round.date),
                      results.length ? `${results.length} parejas` : 'Sin resultados',
                      avgNet != null ? `Net medio ${avgNet}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {results.length > 0 && <span className="pano-rounds__chev">{isOpen ? '−' : '+'}</span>}
              </button>

              {isOpen && results.length > 0 && (
                <div className="pano-rounds__body">
                  <ol className="pano-embed__list">
                    {results.map((res, i) => {
                      const row = ranking.rowsByPairId.get(res.pairId);
                      const detailOpen = openResult === res.id;
                      return (
                        <li key={res.id} className="pano-pairs-round__item">
                          <div className="pano-pairs-round__row">
                            <span className="pano-embed__pos">
                              {String(res.position ?? i + 1).padStart(2, '0')}
                            </span>
                            {nameButton(row, '—')}
                            <span className="pano-pairs-round__hcp">
                              {res.pairHandicap != null ? `Hcp ${res.pairHandicap.toFixed(1)}` : 'Hcp —'}
                            </span>
                            <span className="pano-pairs-round__gross">Brt {res.grossPoints ?? '—'}</span>
                            <span className="pano-embed__points">
                              <strong className="pano-matrix__total">{res.netPoints}</strong>
                              <span className="pano-matrix__unit">Net</span>
                            </span>
                            <button
                              type="button"
                              className="pano-pairs-round__toggle"
                              aria-expanded={detailOpen}
                              onClick={() => setOpenResult(detailOpen ? null : res.id)}
                            >
                              {detailOpen ? '−' : '+'}
                            </button>
                          </div>
                          {detailOpen && (
                            <PairScorecardBlock
                              result={res}
                              round={roundsById.get(res.roundId)}
                              player1={row?.player1 ?? null}
                              player2={row?.player2 ?? null}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const body = () => {
    if (isLoading) return state('Cargando clasificación…');
    if (competitionNotFound) return state('Competición no disponible.');
    if (error) return state('No se ha podido cargar la clasificación. Inténtalo de nuevo más tarde.');
    if (previewMode && !pairResults.length) return state('No hay resultados de parejas importados todavía.');
    if (section === 'rounds') return renderRounds();
    if (section === 'stats') {
      return (
        <PairsCompetitionStats
          rounds={rounds}
          pairResults={pairResults}
          ranking={ranking}
          bestNScores={bestNScores}
          previewMode={previewMode}
          onPairClick={(pairId) => setSelectedPairId(pairId)}
        />
      );
    }
    return renderRanking();
  };


  return (
    <div className="pano-embed pano-pairs" ref={embedRootRef}>
      <div className="pano-embed__inner">
        <p className="pano-embed__eyebrow">Panorámica Golf · Temporada 2026</p>
        <h1 className="pano-embed__title">Orden del Mérito de Parejas 2026</h1>
        <p className="pano-pairs__lead">Clasificación acumulada · Mejores {bestNScores} resultados</p>
        {previewMode && (
          <p className="pano-pairs__preview-flag">VISTA PREVIA · INCLUYE JORNADAS NO PUBLICADAS</p>
        )}

        <div className="pano-embed__primary-nav">
          <nav className="pano-embed__nav" role="tablist" aria-label="Secciones">
            {SECTIONS.map((sec) => (
              <button
                key={sec.key}
                type="button"
                role="tab"
                aria-selected={section === sec.key}
                className="pano-embed__tab"
                onClick={() => setSection(sec.key)}
              >
                {sec.label}
              </button>
            ))}
          </nav>
        </div>

        <section role="tabpanel" aria-label={SECTIONS.find((s) => s.key === section)?.label} aria-live="polite">
          <h2 className="pano-embed__sr">{SECTIONS.find((s) => s.key === section)?.label}</h2>
          {body()}
        </section>
      </div>

      <PairProfileDialog
        row={selectedRow}
        open={!!selectedRow}
        onOpenChange={(o) => !o && setSelectedPairId(null)}
        rounds={rounds}
        roundsById={roundsById}
        pairResults={pairResults}
        bestNScores={bestNScores}
        previewMode={previewMode}
        showInternalValidation={previewMode}
      />
    </div>
  );
};

export default EmbedPairsCompetitionView;
