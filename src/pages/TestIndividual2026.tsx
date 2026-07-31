/**
 * Vista tècnica de prova — ranking individual de la competició individual-2026.
 * No modifica /ranquings ni cap altra vista pública.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCompetitionIndividualRanking,
  type CompetitionRankedPlayer,
} from '@/hooks/useCompetitionIndividualRanking';

const SLUG = 'individual-2026';

const TestIndividual2026 = () => {
  const {
    competition,
    rounds,
    results,
    rankings,
    bestN,
    categoryThreshold,
    isLoading,
    error,
    competitionNotFound,
  } = useCompetitionIndividualRanking(SLUG);

  const [tab, setTab] = useState<'hcpLow' | 'hcpHigh' | 'scratch'>('hcpLow');

  const tabs = [
    { key: 'hcpLow' as const, label: `HCP Baix (≤${categoryThreshold})` },
    { key: 'hcpHigh' as const, label: `HCP Alt (>${categoryThreshold})` },
    { key: 'scratch' as const, label: 'Scratch' },
  ];

  const renderTable = (players: CompetitionRankedPlayer[]) => {
    if (!players.length) {
      return <p className="text-sm text-muted-foreground py-8 text-center">Sense dades</p>;
    }
    return (
      <ul className="divide-y divide-border/30">
        {players.map((p, i) => (
          <li key={p.id} className="grid items-center gap-2 py-2.5" style={{ gridTemplateColumns: '32px minmax(0,1fr) 60px 60px' }}>
            <span className={`font-body text-sm font-semibold tabular-nums ${i < 3 ? 'text-accent' : 'text-secondary-foreground'}`}>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground truncate">{p.name}</span>
              {p.displayHandicap != null && (
                <span className="block text-[11.5px] text-secondary-foreground tabular-nums">HCP {p.displayHandicap}</span>
              )}
            </span>
            <span className="text-xs text-secondary-foreground tabular-nums text-right">{p.roundsPlayed}</span>
            <span className="text-sm font-semibold text-foreground tabular-nums text-right">{p.total}</span>
          </li>
        ))}
      </ul>
    );
  };

  const body = () => {
    if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregant…</p>;
    if (error) return <p className="text-sm text-destructive py-8 text-center">Error de consulta: {error.message}</p>;
    if (competitionNotFound || !competition) {
      return <p className="text-sm text-muted-foreground py-8 text-center">Competició «{SLUG}» no trobada.</p>;
    }
    if (!rounds.length) return <p className="text-sm text-muted-foreground py-8 text-center">Aquesta competició encara no té jornades.</p>;
    if (!results.length) return <p className="text-sm text-muted-foreground py-8 text-center">Les jornades encara no tenen resultats publicats.</p>;
    return (
      <>
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tb) => (
            <Button key={tb.key} size="sm" variant={tab === tb.key ? 'default' : 'outline'} onClick={() => setTab(tb.key)}>
              {tb.label}
            </Button>
          ))}
        </div>
        <div className="grid gap-2 text-[11px] text-secondary-foreground mb-2" style={{ gridTemplateColumns: '32px minmax(0,1fr) 60px 60px' }}>
          <span>#</span><span>Jugador</span><span className="text-right">J</span><span className="text-right">Punts</span>
        </div>
        {renderTable(rankings[tab])}
      </>
    );
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 animate-fade-in">
      <h1 className="font-display text-2xl font-bold mb-1">Vista tècnica — {competition?.name || SLUG}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant="outline">slug: {SLUG}</Badge>
        <Badge variant="outline">best_n_scores: {bestN}</Badge>
        <Badge variant="outline">category_threshold: {categoryThreshold}</Badge>
        <Badge variant="outline">jornades: {rounds.length}</Badge>
        <Badge variant="outline">resultats: {results.length}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Ranking individual</CardTitle>
        </CardHeader>
        <CardContent>{body()}</CardContent>
      </Card>
    </div>
  );
};

export default TestIndividual2026;
