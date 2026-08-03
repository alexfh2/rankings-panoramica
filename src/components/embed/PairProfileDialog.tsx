/**
 * Ficha de pareja del Orden del Mérito de Parejas.
 * Recibe todos los datos ya cargados: no ejecuta ninguna consulta al abrir.
 * En la vista pública nunca muestra licencias.
 * Solo presentación: no altera Net/Brt oficiales ni el ranking.
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PairScorecardBlock from '@/components/embed/PairScorecardBlock';
import type { PairRankingRow, PairResultEntity } from '@/lib/buildPairsRanking';
import type { PairsRound } from '@/hooks/useCompetitionPairsRanking';

type Props = {
  row: PairRankingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rounds: PairsRound[];
  roundsById: Map<string, PairsRound>;
  pairResults: PairResultEntity[];
  bestNScores: number;
  previewMode?: boolean;
};

const CATEGORY_LABEL: Record<'hcp_low' | 'hcp_high', string> = {
  hcp_low: '1ª Categoría',
  hcp_high: '2ª Categoría',
};

const formatDate = (date: string | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

const num = (value: number | null | undefined, digits = 1): string =>
  value == null ? '—' : value.toFixed(digits);

const PairProfileDialog = ({
  row,
  open,
  onOpenChange,
  rounds,
  roundsById,
  pairResults,
  bestNScores,
  previewMode = false,
}: Props) => {
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const history = useMemo(() => {
    if (!row) return [];
    const order = new Map(rounds.map((r, i) => [r.id, i] as const));
    return pairResults
      .filter((r) => r.pairId === row.pairId)
      .sort((a, b) => (order.get(a.roundId) ?? 0) - (order.get(b.roundId) ?? 0));
  }, [row, pairResults, rounds]);

  if (!row) return null;

  const counted = new Set(row.countedRoundIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pano-pair-dialog overflow-y-auto">
        <DialogHeader className="pano-pair-dialog__header">
          <span className="pano-pair-dialog__eyebrow">Orden del Mérito de Parejas</span>
          <DialogTitle className="pano-pair-dialog__title">{row.displayName}</DialogTitle>
          <p className="pano-pair-dialog__lede">
            {CATEGORY_LABEL[row.category]} · Hcp inicial de pareja {num(row.initialPairHandicap)}
          </p>
        </DialogHeader>

        <div className="pano-pair-dialog__stats">
          <span>
            <em>Categoría</em>
            {CATEGORY_LABEL[row.category]}
          </span>
          <span>
            <em>Hcp inicial</em>
            {num(row.initialPairHandicap)}
          </span>
          <span>
            <em>Participaciones</em>
            {row.roundsPlayed}
          </span>
          <span>
            <em>Total (mejores {bestNScores})</em>
            <strong>{row.total}</strong>
          </span>
        </div>

        {previewMode && (
          <div className="pano-pair-dialog__admin">
            <button type="button" onClick={() => setShowAdmin((v) => !v)}>
              DATOS DE ADMINISTRACIÓN {showAdmin ? '−' : '+'}
            </button>
            {showAdmin && (
              <p>
                pair_key: {row.pairKey} · Licencias: {row.player1?.license ?? '—'} / {row.player2?.license ?? '—'}
              </p>
            )}
          </div>
        )}

        <h3 className="pano-pair-dialog__subtitle">Historial por jornadas</h3>

        {history.length === 0 ? (
          <p className="pano-embed__state">Esta pareja todavía no tiene resultados.</p>
        ) : (
          <div className="pano-pairs-history">
            {history.map((res) => {
              const round = roundsById.get(res.roundId);
              const isCounted = counted.has(res.roundId);
              const isOpen = openRound === res.roundId;
              return (
                <div
                  key={res.id}
                  className={`pano-pairs-history__item${isOpen ? ' pano-pairs-history__item--open' : ''}`}
                >
                  <button
                    type="button"
                    className="pano-pairs-history__head"
                    aria-expanded={isOpen}
                    onClick={() => setOpenRound(isOpen ? null : res.roundId)}
                  >
                    <span className="pano-pairs-history__main">
                      <span className="pano-pairs-history__title">
                        {round?.label ?? '—'} · {round?.name ?? '—'}
                        {previewMode && round && !round.isPublished && (
                          <span className="pano-pairs__tag">NO PUBLICADA</span>
                        )}
                      </span>
                      <span className="pano-pairs-history__sub">
                        {formatDate(round?.date ?? null)} · Pos. {res.position ?? '—'}
                      </span>
                    </span>
                    <span className="pano-pairs-history__right">
                      <span
                        className={`pano-pairs-history__net${isCounted ? '' : ' pano-pairs--discarded'}`}
                      >
                        {res.netPoints}
                        <em>Net</em>
                      </span>
                      <span
                        className={`pano-pairs-history__state${
                          isCounted ? '' : ' pano-pairs-history__state--out'
                        }`}
                      >
                        {isCounted ? 'Cuenta' : 'Descartado'}
                      </span>
                      <span className="pano-pairs-history__chev">{isOpen ? '−' : '+'}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pano-pairs-history__body">
                      <dl className="pano-pairs-history__grid">
                        <div>
                          <dt>Hex J1</dt>
                          <dd>{num(res.player1ExactHandicap)}</dd>
                        </div>
                        <div>
                          <dt>Hex J2</dt>
                          <dd>{num(res.player2ExactHandicap)}</dd>
                        </div>
                        <div>
                          <dt>HPU J1</dt>
                          <dd>{res.player1PlayingHandicap ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>HPU J2</dt>
                          <dd>{res.player2PlayingHandicap ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>Hcp pareja</dt>
                          <dd>{num(res.pairHandicap, 2)}</dd>
                        </div>
                        <div>
                          <dt>Brt</dt>
                          <dd>{res.grossPoints ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>Net</dt>
                          <dd>
                            <strong>{res.netPoints}</strong>
                          </dd>
                        </div>
                      </dl>

                      <PairScorecardBlock
                        result={res}
                        round={round}
                        player1={row.player1}
                        player2={row.player2}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PairProfileDialog;
