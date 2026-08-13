/**
 * Resumen editorial COMPACTO de líderes para la portada de Panorámica.
 * Solo lectura y solo presentación: reutiliza los hooks de ranking existentes
 * (useCompetitionIndividualRanking y useCompetitionPairsRanking) y toma siempre
 * el primer elemento de las listas ya ordenadas. No recalcula nada.
 */
import { useMemo } from 'react';
import { useCompetitionIndividualRanking } from '@/hooks/useCompetitionIndividualRanking';
import { useCompetitionPairsRanking } from '@/hooks/useCompetitionPairsRanking';
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';
import { formatPairMemberName } from '@/lib/buildPairsRanking';
import '@/styles/embed-home-leaders.css';

/**
 * Visibilidad de la Liga de Verano.
 * Las competiciones no exponen un estado fiable de actividad (rounds.status es
 * por jornada, no por competición), así que se controla aquí de forma explícita.
 */
export const showSummerLeague = true;

const EMPTY = '—';

type LeaderRow = { category: string; name: string; points: number | null };

const SkeletonRow = () => (
  <li className="pano-leaders__row" aria-hidden="true">
    <span className="pano-leaders__cat">
      <span className="pano-leaders__skeleton" style={{ width: '36px' }} />
    </span>
    <span className="pano-leaders__name">
      <span className="pano-leaders__skeleton" />
    </span>
    <span className="pano-leaders__pts">
      <span className="pano-leaders__skeleton" style={{ width: '32px' }} />
    </span>
  </li>
);

const Block = ({
  header,
  rows,
  loading,
}: {
  header: string;
  rows: LeaderRow[];
  loading: boolean;
}) => (
  <section className="pano-leaders__block">
    <h2 className="pano-leaders__header">{header}</h2>
    <ul className="pano-leaders__rows">
      {loading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : (
        rows.map((row) => (
          <li key={row.category} className="pano-leaders__row">
            <span className="pano-leaders__cat">{row.category}</span>
            <span className="pano-leaders__name">{row.name}</span>
            <span className="pano-leaders__pts">
              {row.points == null ? (
                EMPTY
              ) : (
                <>
                  {row.points}
                  <span>pts</span>
                </>
              )}
            </span>
          </li>
        ))
      )}
    </ul>
  </section>
);

const HomeCompetitionLeaders = () => {
  const individual = useCompetitionIndividualRanking('individual-2026');
  const summer = useCompetitionIndividualRanking('verano-2026');
  const pairs = useCompetitionPairsRanking('parejas-2026');

  const individualRows = useMemo((): LeaderRow[] => {
    const pick = (list: typeof individual.rankings.hcpLow, category: string): LeaderRow => {
      const leader = list[0];
      if (!leader) return { category, name: EMPTY, points: null };
      return {
        category,
        name: formatPlayerDisplayName(leader.name),
        points: leader.total,
      };
    };
    return [pick(individual.rankings.hcpLow, '1ª CAT.'), pick(individual.rankings.hcpHigh, '2ª CAT.')];
  }, [individual.rankings]);

  const pairsRows = useMemo((): LeaderRow[] => {
    return (['hcpLow', 'hcpHigh'] as const).map((key, i) => {
      const category = i === 0 ? '1ª CAT.' : '2ª CAT.';
      const leader = pairs.ranking.rankings[key][0];
      if (!leader) return { category, name: EMPTY, points: null };
      return {
        category,
        name: `${formatPairMemberName(leader.player1)} / ${formatPairMemberName(leader.player2)}`,
        points: leader.total,
      };
    });
  }, [pairs.ranking]);

  const summerRows = useMemo((): LeaderRow[] => {
    const pick = (list: typeof summer.rankings.hcpLow, category: string): LeaderRow => {
      const leader = list[0];
      if (!leader) return { category, name: EMPTY, points: null };
      return {
        category,
        name: formatPlayerDisplayName(leader.name),
        points: leader.total,
      };
    };
    return [pick(summer.rankings.hcpLow, '1ª CAT.'), pick(summer.rankings.hcpHigh, '2ª CAT.')];
  }, [summer.rankings]);

  return (
    <div className="pano-leaders">
      <Block header="Orden del Mérito Individual" rows={individualRows} loading={individual.isLoading} />
      <Block header="Orden del Mérito Parejas" rows={pairsRows} loading={pairs.isLoading} />
      {showSummerLeague && <Block header="Liga de Verano" rows={summerRows} loading={summer.isLoading} />}
    </div>
  );
};

export default HomeCompetitionLeaders;
