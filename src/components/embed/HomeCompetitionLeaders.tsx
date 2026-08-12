/**
 * Resumen editorial COMPACTO de líderes para la portada de Panorámica.
 * Solo lectura y solo presentación: reutiliza los hooks de ranking existentes
 * (useCompetitionIndividualRanking y useCompetitionPairsRanking) y toma siempre
 * el primer elemento de las listas ya ordenadas. No recalcula nada.
 */
import { useMemo } from 'react';
import { useCompetitionIndividualRanking } from '@/hooks/useCompetitionIndividualRanking';
import { useCompetitionPairsRanking } from '@/hooks/useCompetitionPairsRanking';
import {
  buildLatestCompetitionHandicapMap,
  formatHandicapSuffix,
} from '@/lib/buildCompetitionPlayersDirectory';
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
const NO_RESULTS = 'Todavía sin resultados';

type LeaderRow = { category: string; name: string; hcp?: string | null; points: number | null };

const Block = ({
  kicker,
  title,
  href,
  rows,
  loading,
  empty,
}: {
  kicker: string;
  title: string;
  href?: string;
  rows: LeaderRow[];
  loading: boolean;
  empty: boolean;
}) => (
  <section className="pano-leaders__block">
    <p className="pano-leaders__kicker">{kicker}</p>
    <h2 className="pano-leaders__title">
      {href ? (
        <a className="pano-leaders__titlelink" href={href} target="_blank" rel="noopener noreferrer">
          {title}
        </a>
      ) : (
        title
      )}
    </h2>
    {empty && !loading ? (
      <p className="pano-leaders__empty">{NO_RESULTS}</p>
    ) : (
      <ul className="pano-leaders__rows">
        {rows.map((row) => (
          <li key={row.category} className="pano-leaders__row">
            <span className="pano-leaders__cat">{row.category}</span>
            <span className="pano-leaders__name">
              {loading ? <span className="pano-leaders__skeleton" /> : row.name}
              {!loading && row.hcp ? <span className="pano-leaders__hcp">{row.hcp}</span> : null}
            </span>
            <span className="pano-leaders__pts">
              {loading || row.points == null ? (
                EMPTY
              ) : (
                <>
                  {row.points}
                  <span>pts</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const HomeCompetitionLeaders = () => {
  const individual = useCompetitionIndividualRanking('individual-2026');
  const summer = useCompetitionIndividualRanking('verano-2026');
  const pairs = useCompetitionPairsRanking('parejas-2026');

  const individualHcp = useMemo(
    () =>
      buildLatestCompetitionHandicapMap({
        results: individual.results as never,
        rounds: individual.rounds as never,
      }),
    [individual.results, individual.rounds]
  );

  const summerHcp = useMemo(
    () =>
      buildLatestCompetitionHandicapMap({
        results: summer.results as never,
        rounds: summer.rounds as never,
      }),
    [summer.results, summer.rounds]
  );

  const individualRows = (
    data: typeof individual,
    hcpMap: Map<string, number | null>,
    withScratch: boolean
  ): LeaderRow[] => {
    const pick = (list: typeof data.rankings.hcpLow, category: string): LeaderRow => {
      const leader = list[0];
      if (!leader) return { category, name: EMPTY, points: null };
      return {
        category,
        name: formatPlayerDisplayName(leader.name),
        hcp: hcpMap.has(leader.id) ? formatHandicapSuffix(hcpMap.get(leader.id)) : null,
        points: leader.total,
      };
    };
    const rows = [pick(data.rankings.hcpLow, '1ª Cat.'), pick(data.rankings.hcpHigh, '2ª Cat.')];
    if (withScratch) rows.push(pick(data.rankings.scratch, 'Scratch'));
    return rows;
  };

  const pairsRows: LeaderRow[] = (['hcpLow', 'hcpHigh'] as const).map((key, i) => {
    const category = i === 0 ? '1ª Cat.' : '2ª Cat.';
    const leader = pairs.ranking.rankings[key][0];
    if (!leader) return { category, name: EMPTY, points: null };
    return {
      category,
      name: `${formatPairMemberName(leader.player1)} · ${formatPairMemberName(leader.player2)}`,
      hcp:
        leader.initialPairHandicap != null
          ? `(HCP ${leader.initialPairHandicap.toFixed(1).replace('.', ',')})`
          : null,
      points: leader.total,
    };
  });

  const individualEmpty =
    !individual.rankings.hcpLow.length &&
    !individual.rankings.hcpHigh.length &&
    !individual.rankings.scratch.length;
  const summerEmpty = !summer.rankings.hcpLow.length && !summer.rankings.hcpHigh.length;
  const pairsEmpty = !pairs.ranking.rankings.hcpLow.length && !pairs.ranking.rankings.hcpHigh.length;

  return (
    <div className="pano-leaders">
      <div className="pano-leaders__grid">
        <Block
          kicker="Orden del Mérito"
          title="Individual"
          href="https://rankingspanoramica.fairwaystudio.ai/embed/individual-2026"
          rows={individualRows(individual, individualHcp, true)}
          loading={individual.isLoading}
          empty={individualEmpty}
        />
        <Block
          kicker="Orden del Mérito"
          title="Parejas"
          href="https://rankingspanoramica.fairwaystudio.ai/embed/parejas-2026"
          rows={pairsRows}
          loading={pairs.isLoading}
          empty={pairsEmpty}
        />
        {showSummerLeague ? (
          <Block
            kicker="Temporada 2026"
            title="Liga de Verano"
            href="https://rankingspanoramica.fairwaystudio.ai/embed/verano-2026"
            rows={individualRows(summer, summerHcp, false)}
            loading={summer.isLoading}
            empty={summerEmpty}
          />
        ) : null}
      </div>
    </div>
  );
};

export default HomeCompetitionLeaders;
