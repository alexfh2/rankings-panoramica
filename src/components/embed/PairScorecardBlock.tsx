/**
 * Bloque de tarjetas de una participación de pareja en una jornada.
 * - Dos tarjetas individuales en bruto (golpes 1–18, ida, vuelta, total conocido).
 * - Tarjeta Fourball neta SOLO cuando existen los dos HPU y los datos del recorrido.
 * Componente puro: no consulta el backend y no recalcula el Net oficial.
 */
import { useMemo } from 'react';
import { buildFourballScorecard, type FourballContributor } from '@/lib/buildFourballScorecard';
import type { PairResultEntity, PairMember } from '@/lib/buildPairsRanking';
import type { PairsRound } from '@/hooks/useCompetitionPairsRanking';

const CONTRIB: Record<FourballContributor, string> = {
  player_1: 'J1',
  player_2: 'J2',
  tie: '=',
  none: '—',
};

type Props = {
  result: PairResultEntity;
  round: PairsRound | undefined;
  player1: PairMember | null;
  player2: PairMember | null;
  /** Solo en administración: muestra Net/Brt calculados, diferencias y estado de validación. */
  showInternalValidation?: boolean;
};


const holeIndexes = Array.from({ length: 18 }, (_, i) => i);

/** Suma solo si el tramo está completo; si falta un golpe devuelve null (se muestra "—"). */
const sumComplete = (
  scores: readonly (number | null)[] | undefined,
  from: number,
  to: number,
): number | null => {
  let total = 0;
  for (let i = from; i < to; i += 1) {
    const v = scores?.[i];
    if (typeof v !== 'number') return null;
    total += v;
  }
  return total;
};

const fmt = (value: number | null): string => (value == null ? '—' : String(value));

const GrossCard = ({
  name,
  scores,
  hex,
  hpu,
}: {
  name: string;
  scores: readonly (number | null)[] | undefined;
  hex: number | null;
  hpu: number | null;
}) => (
  <div className="pano-pairs-card">
    <div className="pano-pairs-card__head">
      <span className="pano-pairs-card__name">{name}</span>
      <span className="pano-pairs-card__meta">
        Hex {hex != null ? hex.toFixed(1) : '—'} · HPU {hpu != null ? hpu : '—'}
      </span>
    </div>
    <div className="pano-pairs-card__scroll">
      <table className="pano-pairs-table">
        <thead>
          <tr>
            <th>Hoyo</th>
            {holeIndexes.map((i) => (
              <th key={i}>{i + 1}</th>
            ))}
            <th>Ida</th>
            <th>Vta</th>
            <th>Tot</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Golpes</th>
            {holeIndexes.map((i) => {
              const v = scores?.[i];
              return (
                <td key={i} className={v == null ? 'pano-pairs-table__lifted' : undefined}>
                  {v == null ? '—' : v}
                </td>
              );
            })}
            <td>{fmt(sumComplete(scores, 0, 9))}</td>
            <td>{fmt(sumComplete(scores, 9, 18))}</td>
            <td className="pano-pairs-table__total">{fmt(sumComplete(scores, 0, 18))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const PairScorecardBlock = ({
  result,
  round,
  player1,
  player2,
  showInternalValidation = false,
}: Props) => {

  const sc1 = result.player1Scorecard;
  const sc2 = result.player2Scorecard;
  const name1 = player1?.name ?? sc1?.name ?? 'Jugador 1';
  const name2 = player2?.name ?? sc2?.name ?? 'Jugador 2';

  const hpu1 = result.player1PlayingHandicap ?? sc1?.playingHandicap ?? null;
  const hpu2 = result.player2PlayingHandicap ?? sc2?.playingHandicap ?? null;

  const fourball = useMemo(() => {
    if (hpu1 == null || hpu2 == null) return null;
    if (!round?.coursePar || !round?.courseHandicap) return null;
    if (!sc1?.scores || !sc2?.scores) return null;
    return buildFourballScorecard({
      player1: {
        playerId: player1?.id ?? 'p1',
        name: name1,
        gender: player1?.gender ?? sc1.gender ?? null,
        scorecard: { scores: sc1.scores, liftedHoles: sc1.liftedHoles },
        exactHandicap: result.player1ExactHandicap,
        playingHandicap: hpu1,
      },
      player2: {
        playerId: player2?.id ?? 'p2',
        name: name2,
        gender: player2?.gender ?? sc2.gender ?? null,
        scorecard: { scores: sc2.scores, liftedHoles: sc2.liftedHoles },
        exactHandicap: result.player2ExactHandicap,
        playingHandicap: hpu2,
      },
      coursePar: round.coursePar,
      courseHandicap: round.courseHandicap,
      courseHandicapWomen: round.courseHandicapWomen,
      officialNetPoints: result.netPoints,
      officialGrossPoints: result.grossPoints,
    });
  }, [hpu1, hpu2, round, sc1, sc2, name1, name2, player1, player2, result]);

  const fourballUsable = fourball && fourball.calculatedNetPoints != null;
  /**
   * Público: la tabla Fourball solo se muestra si la validación interna es correcta.
   * Admin: se muestra siempre que se pueda reconstruir, junto al detalle técnico.
   */
  const showFourballTable =
    fourballUsable && (showInternalValidation || fourball!.validationStatus === 'valid');

  return (
    <div className="pano-fourball-card">
      <GrossCard name={name1} scores={sc1?.scores} hex={result.player1ExactHandicap} hpu={hpu1} />
      <GrossCard name={name2} scores={sc2?.scores} hex={result.player2ExactHandicap} hpu={hpu2} />

      {showFourballTable ? (
        <div className="pano-pairs-card pano-pairs-card--fourball">
          <div className="pano-pairs-card__head">
            <span className="pano-pairs-card__name">Tarjeta Fourball</span>
            <span className="pano-pairs-card__meta">
              {showInternalValidation ? (
                <>
                  <span className="pano-pairs-card__internal">VALIDACIÓN INTERNA</span> Net oficial{' '}
                  {result.netPoints} · Net calculado {fourball!.calculatedNetPoints} · Brt oficial{' '}
                  {result.grossPoints ?? '—'} · Brt calculado {fourball!.calculatedGrossPoints ?? '—'} ·
                  Diferencia {fourball!.netDifference ?? '—'} ·{' '}
                  {fourball!.netMatchesOfficial ? 'Coincide' : 'Revisar diferencia'} ·{' '}
                  {fourball!.validationStatus}
                </>
              ) : (
                <>Net oficial: {result.netPoints}</>
              )}
            </span>
          </div>

          <div className="pano-pairs-card__scroll">
            <table className="pano-pairs-table">
              <thead>
                <tr>
                  <th>Hoyo</th>
                  {fourball!.holes.map((h) => (
                    <th key={h.hole}>{h.hole}</th>
                  ))}
                  <th>Tot</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">J1 net</th>
                  {fourball!.holes.map((h) => (
                    <td key={h.hole}>{h.player1.netPoints}</td>
                  ))}
                  <td className="pano-pairs-table__total">{fourball!.playerNetPoints.player1 ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">J2 net</th>
                  {fourball!.holes.map((h) => (
                    <td key={h.hole}>{h.player2.netPoints}</td>
                  ))}
                  <td className="pano-pairs-table__total">{fourball!.playerNetPoints.player2 ?? '—'}</td>
                </tr>
                <tr className="pano-pairs-table__pairrow">
                  <th scope="row">Pareja</th>
                  {fourball!.holes.map((h) => (
                    <td key={h.hole}>{h.pairNetPoints}</td>
                  ))}
                  <td className="pano-pairs-table__total">{fourball!.calculatedNetPoints}</td>
                </tr>
                <tr>
                  <th scope="row">Aporta</th>
                  {fourball!.holes.map((h) => (
                    <td key={h.hole} className="pano-pairs-table__contrib">
                      {CONTRIB[h.netContributor]}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="pano-pairs-notice">
          <strong>Resultado Net oficial: {result.netPoints}</strong>
          <span>
            No se puede reconstruir la tarjeta Fourball neta porque faltan datos de hándicap de juego o del
            recorrido.
          </span>
        </div>
      )}
    </div>
  );
};

export default PairScorecardBlock;
