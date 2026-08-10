/**
 * Fusió i validació de resultats individuals llegits de GolfDirecto.
 *
 * Aquesta capa NO calcula res pel seu compte: reutilitza el motor Stableford
 * existent del projecte (src/lib/stableford.ts) per obtenir els punts
 * Hàndicap/Net i Scratch/Brut a partir de la targeta completa.
 *
 * Només afecta l'entrada de dades. No toca rànquings ni parelles.
 */
import { calcStablefordPoints, calcScratchStablefordPoints } from '@/lib/stableford';

export type GolfDirectoWarningCode =
  | 'GOLFDIRECTO_DUPLICATE_PLAYER'
  | 'GOLFDIRECTO_PLAYER_CONFLICT'
  | 'GOLFDIRECTO_MISSING_SCORECARD'
  | 'GOLFDIRECTO_CALCULATION_MISMATCH'
  | 'GOLFDIRECTO_METADATA_MISMATCH'
  | 'GOLFDIRECTO_DIFFERENT_GAME';

export interface GolfDirectoWarning {
  code: GolfDirectoWarningCode;
  message: string;
  player?: string;
}

export interface RawGolfDirectoEntry {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: (number | null)[];
  source_url: string;
  source_player_id?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  official_net_points?: number | null;
  official_gross_points?: number | null;
  official_strokes?: number | null;
  pars?: number[] | null;
  hole_hcp?: number[] | null;
  _is_senior?: boolean;
}

export interface MergedGolfDirectoEntry extends RawGolfDirectoEntry {
  /** Categories de GolfDirecto d'on prové el jugador. */
  source_categories: string[];
  computed_net_points: number | null;
  computed_scratch_points: number | null;
  /** Total de GOLPES dels 18 forats. null si algun forat no té resultat (bola aixecada). */
  total_strokes: number | null;
  /** Subtotals de GOLPES (null si el tram és incomplet). */
  out_strokes: number | null;
  in_strokes: number | null;
  has_full_scorecard: boolean;
  validation: 'valid' | 'mismatch' | 'no_reference' | 'insufficient_data';
}


export interface MergeGolfDirectoOutput {
  results: MergedGolfDirectoEntry[];
  warnings: GolfDirectoWarning[];
  summary: {
    categories: number;
    uniquePlayers: number;
    fullScorecards: number;
    duplicates: number;
    warnings: number;
  };
}

const normalizeLicense = (license?: string | null): string =>
  (license || '').toUpperCase().replace(/[\s._/-]/g, '');

const normalizeName = (name?: string | null): string =>
  (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** Clau d'identitat: id estable de GolfDirecto > llicència normalitzada > nom normalitzat. */
export const golfDirectoIdentityKey = (entry: RawGolfDirectoEntry): string => {
  if (entry.source_player_id) return `id:${entry.source_player_id}`;
  const lic = normalizeLicense(entry.license);
  if (lic) return `lic:${lic}`;
  return `name:${normalizeName(entry.name)}`;
};

const holesPlayed = (scores: (number | null)[]): number =>
  scores.filter((s) => s != null && s > 0).length;

const sameScores = (a: (number | null)[], b: (number | null)[]): boolean =>
  a.length === b.length && a.every((v, i) => (v ?? 0) === (b[i] ?? 0));

/** Punts Stableford Net i Scratch calculats amb el motor existent del projecte. */
export const computeGolfDirectoStableford = (
  entry: RawGolfDirectoEntry
): { net: number | null; scratch: number | null } => {
  const scores = entry.scores || [];
  const pars = entry.pars || null;
  const hcps = entry.hole_hcp || null;
  if (!pars || pars.length !== scores.length || scores.length === 0) {
    return { net: null, scratch: null };
  }
  const playingHcp = entry.handicap_play ?? entry.handicap;

  let scratch = 0;
  let net: number | null = playingHcp != null && hcps && hcps.length === scores.length ? 0 : null;

  for (let i = 0; i < scores.length; i++) {
    const gross = scores[i];
    if (gross == null || gross === 0) continue;
    scratch += calcScratchStablefordPoints(gross, pars[i]) ?? 0;
    if (net != null && hcps && playingHcp != null) {
      net += calcStablefordPoints(gross, pars[i], hcps[i], playingHcp) ?? 0;
    }
  }
  return { net, scratch };
};

/**
 * Fusiona les entrades de totes les categories d'una mateixa prova en una única
 * llista de participacions (una per jugador) i genera els avisos corresponents.
 */
export const mergeGolfDirectoResults = (
  entries: RawGolfDirectoEntry[],
  options: { categoryCount?: number } = {}
): MergeGolfDirectoOutput => {
  const warnings: GolfDirectoWarning[] = [];
  const byKey = new Map<string, MergedGolfDirectoEntry>();
  let duplicates = 0;

  for (const raw of entries) {
    const key = golfDirectoIdentityKey(raw);
    const existing = byKey.get(key);
    const categoryLabel = raw.category_name || raw.category_id || raw.source_url;

    if (!existing) {
      byKey.set(key, {
        ...raw,
        source_categories: [categoryLabel],
        computed_net_points: null,
        computed_scratch_points: null,
        total_strokes: null,
        out_strokes: null,
        in_strokes: null,
        has_full_scorecard: false,

        validation: 'no_reference',
      });
      continue;
    }

    duplicates++;
    if (!existing.source_categories.includes(categoryLabel)) {
      existing.source_categories.push(categoryLabel);
    }
    warnings.push({
      code: 'GOLFDIRECTO_DUPLICATE_PLAYER',
      player: raw.name,
      message: `"${raw.name}" apareix a més d'una categoria de GolfDirecto (${existing.source_categories.join(', ')}). S'ha conservat una única participació.`,
    });

    const conflicts: string[] = [];
    if (raw.handicap != null && existing.handicap != null && raw.handicap !== existing.handicap) {
      conflicts.push(`HCP exacte ${existing.handicap} vs ${raw.handicap}`);
    }
    if (
      raw.handicap_play != null &&
      existing.handicap_play != null &&
      raw.handicap_play !== existing.handicap_play
    ) {
      conflicts.push(`HCP de joc ${existing.handicap_play} vs ${raw.handicap_play}`);
    }
    if (
      raw.official_net_points != null &&
      existing.official_net_points != null &&
      raw.official_net_points !== existing.official_net_points
    ) {
      conflicts.push(`Net oficial ${existing.official_net_points} vs ${raw.official_net_points}`);
    }
    if (
      raw.scores?.length &&
      existing.scores?.length &&
      !sameScores(raw.scores, existing.scores)
    ) {
      conflicts.push('targetes diferents');
    }
    if (conflicts.length > 0) {
      warnings.push({
        code: 'GOLFDIRECTO_PLAYER_CONFLICT',
        player: raw.name,
        message: `"${raw.name}" té dades diferents entre categories: ${conflicts.join('; ')}. No s'ha sobreescrit res automàticament.`,
      });
    }

    // Completar només allò que faltava (mai sobreescriure en silenci).
    if (holesPlayed(raw.scores || []) > holesPlayed(existing.scores || [])) {
      existing.scores = raw.scores;
      existing.pars = raw.pars ?? existing.pars;
      existing.hole_hcp = raw.hole_hcp ?? existing.hole_hcp;
    }
    if (existing.handicap == null) existing.handicap = raw.handicap;
    if (existing.handicap_play == null) existing.handicap_play = raw.handicap_play;
    if (existing.license === '' && raw.license) existing.license = raw.license;
    if (existing.official_net_points == null) existing.official_net_points = raw.official_net_points ?? null;
    if (existing.official_gross_points == null) existing.official_gross_points = raw.official_gross_points ?? null;
    if (existing.official_strokes == null) existing.official_strokes = raw.official_strokes ?? null;
    if (existing.stableford_points == null) existing.stableford_points = raw.stableford_points;
    if (existing.scratch_score == null) existing.scratch_score = raw.scratch_score;
    existing._is_senior = existing._is_senior || raw._is_senior;
  }

  const results = Array.from(byKey.values());

  for (const entry of results) {
    const played = holesPlayed(entry.scores || []);
    entry.has_full_scorecard = played === 18;
    if (played === 0) {
      warnings.push({
        code: 'GOLFDIRECTO_MISSING_SCORECARD',
        player: entry.name,
        message: `No s'ha pogut recuperar la targeta de "${entry.name}".`,
      });
    }

    // Totals de GOLPES: mai sumes parcials. Un forat sense resultat → null.
    const strokeTotals = computeStrokeTotals(entry.scores || []);
    entry.out_strokes = strokeTotals.out;
    entry.in_strokes = strokeTotals.in;
    entry.total_strokes = strokeTotals.total;

    // Punts Stableford (Net i Scratch): lògica intacta, es calculen igualment
    // encara que la targeta tingui forats sense resultat.
    const { net, scratch } = computeGolfDirectoStableford(entry);
    entry.computed_net_points = net;
    entry.computed_scratch_points = scratch;


    const official = entry.official_net_points ?? entry.stableford_points;
    if (net == null || official == null) {
      entry.validation = net == null ? 'insufficient_data' : 'no_reference';
    } else if (net === official) {
      entry.validation = 'valid';
    } else {
      entry.validation = 'mismatch';
      warnings.push({
        code: 'GOLFDIRECTO_CALCULATION_MISMATCH',
        player: entry.name,
        message: `"${entry.name}": Net oficial de GolfDirecto ${official} ≠ Net calculat ${net}. Es conserva el valor oficial.`,
      });
    }
  }

  results.sort((a, b) => (a.position || 9999) - (b.position || 9999));

  return {
    results,
    warnings,
    summary: {
      categories: options.categoryCount ?? new Set(results.flatMap((r) => r.source_categories)).size,
      uniquePlayers: results.length,
      fullScorecards: results.filter((r) => r.has_full_scorecard).length,
      duplicates,
      warnings: warnings.length,
    },
  };
};
