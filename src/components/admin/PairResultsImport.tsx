import { resolvePairsWomenHoleHandicap } from '@/lib/panoramicaPairsCourse';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  MinusCircle,
  Upload,
  X,
} from 'lucide-react';
import {
  parsePairExcelResults,
  normalizePairLicense,
  DEFAULT_PAIR_CATEGORY_THRESHOLD,
  type ParsePairExcelResult,
} from '@/lib/parsePairExcelResults';
import {
  buildFourballScorecard,
  type FourballScorecardResult,
  type FourballValidationStatus,
  type FourballContributor,
} from '@/lib/buildFourballScorecard';
import {
  buildPairImportPayload,
  mapPairImportError,
  type PairImportRpcSummary,
} from '@/lib/buildPairImportPayload';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  applyLicenseResolutions,
  normalizeNameForSearch,
  rankUnlicensedCandidates,
  resolutionKey,
  resolvePlayerStatus,
  type LicenseResolution,
  type PlayerSlot,
  type ResolvedPlayerStatus,
} from '@/lib/pairLicenseResolution';
import { splitUrlLines, validateSameGolfDirectoGame } from '@/lib/golfDirectoUrl';
import {
  golfDirectoPairsToParsedPairs,
  type GolfDirectoPairsResponse,
} from '@/lib/golfDirectoPairsToParsedPairs';


interface Props {
  roundId: string;
  competitionId: string;
  onClose?: () => void;
  onCompleted?: () => void;
}

type PlayerMatchStatus = ResolvedPlayerStatus;

const toNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null;
  const arr = value.map((v) => (typeof v === 'number' ? v : Number(v)));
  if (arr.length !== 18 || arr.some((n) => !Number.isFinite(n))) return null;
  return arr;
};

const VALIDATION_LABEL: Record<FourballValidationStatus, string> = {
  valid: 'Coincide',
  mismatch: 'Revisar diferencia',
  provisional: 'Validación provisional',
  insufficient_data: 'Faltan datos del recorrido',
};

const ValidationBadge = ({ status }: { status: FourballValidationStatus }) => {
  const cls =
    status === 'valid'
      ? 'border-emerald-600/40 text-emerald-600'
      : status === 'mismatch'
        ? 'border-destructive/40 text-destructive'
        : status === 'provisional'
          ? 'border-amber-600/40 text-amber-600'
          : 'border-muted-foreground/30 text-muted-foreground';
  const Icon =
    status === 'valid' ? Check : status === 'mismatch' ? AlertTriangle : status === 'provisional' ? HelpCircle : MinusCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${cls}`}>
      <Icon className="h-3 w-3" />
      {VALIDATION_LABEL[status]}
    </span>
  );
};

const PlayerStatusBadge = ({ status }: { status: PlayerMatchStatus }) => {
  if (status === 'existing') {
    return <span className="text-[11px] text-emerald-600">Existente</span>;
  }
  if (status === 'new') {
    return <span className="text-[11px] text-amber-600">Nuevo</span>;
  }
  if (status === 'no_license_confirmed') {
    return <span className="text-[11px] text-emerald-600">✓ Sin licencia confirmado</span>;
  }
  if (status === 'linked') {
    return <span className="text-[11px] text-emerald-600">✓ Vinculado a jugador existente</span>;
  }
  return <span className="text-[11px] text-destructive">⚠ Falta licencia — revisión manual</span>;
};

const CONTRIB_MARK: Record<FourballContributor, string> = {
  player_1: 'J1',
  player_2: 'J2',
  tie: '=',
  none: '—',
};

const PairResultsImport = ({ roundId, competitionId, onClose, onCompleted }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<'excel' | 'golfdirecto'>('excel');
  const [gdUrls, setGdUrls] = useState('');
  const [gdLoading, setGdLoading] = useState(false);
  const [gdError, setGdError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsePairExcelResult | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resolutions, setResolutions] = useState<Map<string, LicenseResolution>>(new Map());
  const [licenseDialog, setLicenseDialog] = useState<{ key: string; name: string } | null>(null);
  const [licenseInput, setLicenseInput] = useState('');
  const [confirmNoLicense, setConfirmNoLicense] = useState<{ key: string; name: string } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ key: string; name: string } | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSelected, setLinkSelected] = useState<string | null>(null);

  const setResolution = (key: string, value: LicenseResolution | null) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const [importResult, setImportResult] = useState<PairImportRpcSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);


  const { data: round } = useQuery({
    queryKey: ['admin-pair-import-round', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('id, name, date, round_number, competition_id, course_par, course_handicap, course_handicap_women, status')
        .eq('id', roundId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: competition } = useQuery({
    queryKey: ['admin-pair-import-competition', competitionId],
    enabled: !!competitionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, format, rules_config')
        .eq('id', competitionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const categoryThreshold = useMemo(() => {
    const cfg = competition?.rules_config as Record<string, unknown> | null | undefined;
    const raw = cfg?.category_threshold;
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) && raw != null ? num : DEFAULT_PAIR_CATEGORY_THRESHOLD;
  }, [competition]);

  const coursePar = useMemo(() => toNumberArray(round?.course_par), [round]);
  const courseHandicap = useMemo(() => toNumberArray(round?.course_handicap), [round]);
  const courseHandicapWomen = useMemo(() => toNumberArray(round?.course_handicap_women), [round]);
  const courseIncomplete = !coursePar || !courseHandicap;

  const licenses = useMemo(() => {
    if (!parsed) return [] as string[];
    const set = new Set<string>();
    for (const pair of parsed.pairs) {
      for (const p of [pair.player1, pair.player2]) {
        if (p.licenseNormalized) set.add(p.licenseNormalized);
      }
    }
    return Array.from(set).sort();
  }, [parsed]);

  const { data: playersByLicense } = useQuery({
    queryKey: ['admin-pair-import-players', roundId, competitionId, fileName, licenses.join(',')],
    enabled: licenses.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('id, license, name');
      if (error) throw error;
      const map = new Map<string, { id: string; name: string }>();
      for (const row of data ?? []) {
        const norm = normalizePairLicense(row.license);
        if (norm) map.set(norm, { id: row.id, name: row.name });
      }
      return map;
    },
  });

  const { data: existingPairKeys } = useQuery({
    queryKey: ['admin-pair-import-pairs', competitionId],
    enabled: !!competitionId && !!parsed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('id, pair_key')
        .eq('competition_id', competitionId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.pair_key));
    },
  });

  const hasMissingLicense = !!parsed?.pairs.some((p) => !p.player1.licenseNormalized || !p.player2.licenseNormalized);

  // Solo jugadores confirmados sin licencia (license IS NULL AND license_exempt = true).
  const { data: unlicensedPlayers } = useQuery({
    queryKey: ['admin-pair-import-unlicensed-players'],
    enabled: hasMissingLicense,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, gender, current_handicap, created_at')
        .is('license', null)
        .eq('license_exempt', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pairsByPlayers } = useQuery({
    queryKey: ['admin-pair-import-pairs-by-players', competitionId],
    enabled: !!competitionId && !!parsed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('player_1_id, player_2_id')
        .eq('competition_id', competitionId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => [r.player_1_id, r.player_2_id].sort().join('|')));
    },
  });

  const rows = useMemo(() => {
    if (!parsed) return [];
    return parsed.pairs.map((sourcePair, index) => {
      const resolved = applyLicenseResolutions(
        sourcePair,
        resolutions.get(resolutionKey(index, 1)),
        resolutions.get(resolutionKey(index, 2)),
      );
      const pair = resolved.pair;
      const fourball: FourballScorecardResult | null =
        pair.player1.name && pair.player2.name
          ? buildFourballScorecard({
              player1: {
                playerId: pair.player1.licenseNormalized ?? `row-${pair.player1.sourceRow}`,
                name: pair.player1.name,
                gender: pair.player1.gender,
                scorecard: { scores: pair.player1.scores, liftedHoles: pair.player1.liftedHoles },
                exactHandicap: pair.player1.exactHandicap,
                playingHandicap: pair.player1.playingHandicap,
              },
              player2: {
                playerId: pair.player2.licenseNormalized ?? `row-${pair.player2.sourceRow}`,
                name: pair.player2.name,
                gender: pair.player2.gender,
                scorecard: { scores: pair.player2.scores, liftedHoles: pair.player2.liftedHoles },
                exactHandicap: pair.player2.exactHandicap,
                playingHandicap: pair.player2.playingHandicap,
              },
              coursePar,
              courseHandicap,
              courseHandicapWomen: resolvePairsWomenHoleHandicap(courseHandicap, courseHandicapWomen),
              officialNetPoints: pair.netPoints,
              officialGrossPoints: pair.grossPoints,
            })
          : null;
      return {
        index,
        pair,
        fourball,
        resolved,
        missing1: !sourcePair.player1.licenseNormalized,
        missing2: !sourcePair.player2.licenseNormalized,
        status1: resolvePlayerStatus(pair.player1, resolved.meta1, resolved.identityResolved, playersByLicense),
        status2: resolvePlayerStatus(pair.player2, resolved.meta2, resolved.identityResolved, playersByLicense),
        pairExists: (() => {
          if (pair.pairKey && !resolved.meta1.noLicenseConfirmed && !resolved.meta2.noLicenseConfirmed && existingPairKeys?.has(pair.pairKey)) return true;
          const id1 = resolved.meta1.fairwayPlayerId ?? (pair.player1.licenseNormalized ? playersByLicense?.get(pair.player1.licenseNormalized)?.id : undefined);
          const id2 = resolved.meta2.fairwayPlayerId ?? (pair.player2.licenseNormalized ? playersByLicense?.get(pair.player2.licenseNormalized)?.id : undefined);
          return !!(id1 && id2 && pairsByPlayers?.has([id1, id2].sort().join('|')));
        })(),
      };
    });
  }, [parsed, resolutions, coursePar, courseHandicap, courseHandicapWomen, playersByLicense, existingPairKeys, pairsByPlayers]);

  const summary = useMemo(() => {
    const blockingErrors = parsed?.errors.filter((e) => e.blocking) ?? [];
    const existingPlayers = rows.reduce(
      (acc, r) => acc + (r.status1 === 'existing' ? 1 : 0) + (r.status2 === 'existing' ? 1 : 0),
      0,
    );
    const newPlayers = rows.reduce(
      (acc, r) => acc + (r.status1 === 'new' ? 1 : 0) + (r.status2 === 'new' ? 1 : 0),
      0,
    );
    const manualPlayers = rows.reduce(
      (acc, r) => acc + (r.status1 === 'manual_review' ? 1 : 0) + (r.status2 === 'manual_review' ? 1 : 0),
      0,
    );
    const netMatch = rows.filter((r) => r.fourball?.netMatchesOfficial === true).length;
    const netMismatch = rows.filter((r) => r.fourball?.netMatchesOfficial === false).length;
    const weak = rows.filter(
      (r) => r.fourball?.validationStatus === 'insufficient_data' || r.fourball?.validationStatus === 'provisional',
    ).length;

    const canImport =
      !!parsed &&
      parsed.pairs.length > 0 &&
      blockingErrors.length === 0 &&
      rows.every(
        (r) =>
          !!r.pair.player1.name &&
          !!r.pair.player2.name &&
          r.pair.netPoints != null &&
          r.resolved.identityResolved &&
          r.status1 !== 'manual_review' &&
          r.status2 !== 'manual_review',
      );

    const blockers: string[] = [];
    if (parsed && parsed.pairs.length === 0) blockers.push('El archivo no contiene parejas.');
    if (blockingErrors.length > 0) blockers.push(`${blockingErrors.length} error(es) bloqueante(s) del parser.`);
    if (rows.some((r) => !r.pair.player1.name || !r.pair.player2.name)) blockers.push('Hay parejas incompletas.');
    if (rows.some((r) => r.pair.netPoints == null)) blockers.push('Hay parejas sin Net oficial.');
    if (rows.some((r) => !r.resolved.identityResolved)) blockers.push('Hay parejas sin identidad válida.');
    if (manualPlayers > 0) blockers.push(`${manualPlayers} jugador(es) requieren revisión manual.`);

    return {
      detected: parsed?.pairs.length ?? 0,
      valid: rows.filter((r) => r.pair.isValid).length,
      withErrors: rows.filter((r) => !r.pair.isValid).length,
      existingPlayers,
      newPlayers,
      manualPlayers,
      netMatch,
      netMismatch,
      weak,
      blockingErrors,
      canImport,
      blockers,
    };
  }, [parsed, rows]);

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const result = parsePairExcelResults(workbook, { categoryThreshold });
      setParsed(result);
      setFileName(file.name);
      setExpanded(new Set());
      setResolutions(new Map());
      setImportResult(null);
      setImportError(null);
      if (result.errors.some((e) => e.blocking)) {
        toast({
          title: 'Archivo con errores',
          description: 'Revisa la previsualización: el archivo no está listo para importar.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'No se ha podido leer el archivo',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const handleGolfDirecto = async () => {
    setGdError(null);
    const urls = splitUrlLines(gdUrls);
    if (urls.length === 0) return;
    const check = validateSameGolfDirectoGame(urls);
    if (!check.ok) {
      setGdError(check.error ?? 'Enlaces de GolfDirecto no válidos.');
      return;
    }
    setGdLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-golfdirecto-pairs', { body: { urls } });
      const response = (data ?? null) as GolfDirectoPairsResponse | null;
      if (error || !response?.success) {
        let message = response?.error;
        if (!message && error && 'context' in error) {
          try {
            message = (await (error as { context: Response }).context.json())?.error;
          } catch { /* ignore */ }
        }
        throw new Error(message || 'No se han podido leer los resultados de GolfDirecto.');
      }
      const result = golfDirectoPairsToParsedPairs(response, { categoryThreshold });
      setParsed(result);
      setFileName(`golfdirecto:${response.game?.id ?? check.gameId}`);
      setExpanded(new Set());
      setResolutions(new Map());
      setImportResult(null);
      setImportError(null);
    } catch (err) {
      setGdError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGdLoading(false);
    }
  };

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const fourballWarningPending = rows.some(
    (r) =>
      r.fourball?.validationStatus === 'mismatch' ||
      r.fourball?.validationStatus === 'provisional' ||
      r.fourball?.validationStatus === 'insufficient_data',
  );

  const canTriggerImport =
    summary.canImport && !!fileName && !!roundId && !!competitionId && !importing && !importResult;

  const runImport = async () => {
    if (!canTriggerImport || !fileName) return;
    setImporting(true);
    setImportError(null);
    setConfirmOpen(false);
    try {
      const payload = buildPairImportPayload(
        rows.map((r) => ({ pair: r.pair, fourball: r.fourball, meta1: r.resolved.meta1, meta2: r.resolved.meta2 })),
      );
      const { data, error } = await supabase.rpc('import_pair_results_batch', {
        p_round_id: roundId,
        p_source_filename: fileName,
        p_pairs: payload as unknown as never,
      });
      if (error) throw error;
      setImportResult((data ?? {}) as PairImportRpcSummary);
      toast({ title: 'Resultados de parejas importados correctamente.' });
      queryClient.invalidateQueries({ queryKey: ['admin-pair-import-players'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pair-import-pairs', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-pair-import-pairs-by-players', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-pair-import-unlicensed-players'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pair-results', roundId] });
      queryClient.invalidateQueries({ queryKey: ['admin-import-logs', roundId] });
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error('[PairResultsImport] import_pair_results_batch failed', err);
      setImportError(mapPairImportError(raw));
      toast({ title: 'No se ha podido importar el archivo.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleFinish = () => {
    onCompleted?.();
    setParsed(null);
    setFileName(null);
    setExpanded(new Set());
    setImportResult(null);
    setImportError(null);
    onClose?.();
  };


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded border border-border bg-muted/20 p-3 text-xs">
        <div className="font-display text-sm">{competition?.name ?? 'Competición'}</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>Prueba: {round?.name ?? '—'}</span>
          <span>Jornada: {round?.round_number ?? '—'}</span>
          <span>Fecha: {round?.date ?? '—'}</span>
          <span>Estado: {round?.status ?? '—'}</span>
          <span>Umbral categoría: {categoryThreshold}</span>
        </div>
      </div>

      {/* Source selector */}
      <div className="flex gap-2">
        <Button
          variant={source === 'excel' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSource('excel')}
          disabled={gdLoading || importing}
        >
          Excel
        </Button>
        <Button
          variant={source === 'golfdirecto' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSource('golfdirecto')}
          disabled={gdLoading || importing}
        >
          GolfDirecto
        </Button>
      </div>

      {source === 'golfdirecto' && (
        <div className="space-y-2">
          <Textarea
            value={gdUrls}
            onChange={(e) => setGdUrls(e.target.value)}
            rows={3}
            placeholder={'Enlace Hándicap Inferior\nEnlace Hándicap Superior'}
            className="text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void handleGolfDirecto()} disabled={gdLoading || !gdUrls.trim()}>
              {gdLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {gdLoading ? 'Leyendo GolfDirecto…' : 'Leer resultados de GolfDirecto'}
            </Button>
            <span className="text-[11px] text-muted-foreground">Un enlace por línea, todas las categorías del mismo torneo.</span>
          </div>
          {gdError && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{gdError}</div>
          )}
        </div>
      )}

      {/* File input */}
      {source === 'excel' && (
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Seleccionar Excel de parejas
        </Button>
        {fileName && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName}
            {parsed?.sheetName ? ` · hoja ${parsed.sheetName}` : ''}
          </span>
        )}
      </div>
      )}

      {courseIncomplete && parsed && (
        <div className="flex items-start gap-2 rounded border border-amber-600/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          No se puede validar la tarjeta Fourball porque faltan datos del recorrido.
        </div>
      )}

      {parsed && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
            <div>Parejas detectadas: <strong>{summary.detected}</strong></div>
            <div>Parejas válidas: <strong>{summary.valid}</strong></div>
            <div>Parejas con errores: <strong>{summary.withErrors}</strong></div>
            <div>Jugadores existentes: <strong>{summary.existingPlayers}</strong></div>
            <div>Jugadores nuevos: <strong>{summary.newPlayers}</strong></div>
            <div>Revisión manual: <strong>{summary.manualPlayers}</strong></div>
            <div>Net coincidente: <strong>{summary.netMatch}</strong></div>
            <div>Net con discrepancia: <strong>{summary.netMismatch}</strong></div>
            <div>Validación insuficiente/provisional: <strong>{summary.weak}</strong></div>
          </div>

          {summary.blockingErrors.length > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <X className="h-4 w-4" />
                El archivo no está listo para importar
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {summary.blockingErrors.slice(0, 12).map((e, i) => (
                  <li key={i}>
                    {e.row ? `Fila ${e.row}: ` : ''}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview list */}
          <div className="space-y-2">
            {rows.map((row) => {
              const { pair, fourball } = row;
              const isOpen = expanded.has(row.index);
              return (
                <Card key={row.index} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-display text-sm">#{pair.position ?? '—'}</span>
                          <Badge variant={row.pairExists ? 'secondary' : 'outline'} className="text-[10px]">
                            {row.pairExists ? 'Pareja existente' : 'Pareja nueva'}
                          </Badge>
                          <span className="text-muted-foreground">
                            HCP pareja: {pair.pairHandicap != null ? pair.pairHandicap.toFixed(1) : '—'}
                          </span>
                          <span className="text-muted-foreground">
                            Cat: {pair.category === 'hcp_low' ? 'Baja' : pair.category === 'hcp_high' ? 'Alta' : '—'}
                          </span>
                          {fourball && <ValidationBadge status={fourball.validationStatus} />}
                          {!pair.isValid && (
                            <span className="text-[11px] text-destructive">Pareja con errores</span>
                          )}
                        </div>

                        <div className="grid gap-1 sm:grid-cols-2">
                          {[
                            { p: pair.player1, s: row.status1, label: 'J1', slot: 1 as PlayerSlot, missing: row.missing1, entered: row.resolved.licenseEntered1 },
                            { p: pair.player2, s: row.status2, label: 'J2', slot: 2 as PlayerSlot, missing: row.missing2, entered: row.resolved.licenseEntered2 },
                          ].map(({ p, s, label, slot, missing, entered }) => (
                            <div key={label} className="text-xs">
                              <span className="text-muted-foreground">{label}</span>{' '}
                              <span className="font-medium">{p.name || '—'}</span>
                              <div className="text-[11px] text-muted-foreground">
                                Lic: {p.licenseNormalized ?? '—'} · Hex:{' '}
                                {p.exactHandicap != null ? p.exactHandicap : '—'} · Hpu:{' '}
                                {p.playingHandicap != null ? p.playingHandicap : '—'} · <PlayerStatusBadge status={s} />
                                {entered && <span className="text-[11px] text-emerald-600"> · ✓ Licencia introducida</span>}
                              </div>
                              {missing && !importResult && (() => {
                                const key = resolutionKey(row.index, slot);
                                const current = resolutions.get(key);
                                return (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {current ? (
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setResolution(key, null)}>
                                        Deshacer
                                      </Button>
                                    ) : (
                                      <>
                                        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { setLicenseInput(''); setLicenseDialog({ key, name: p.name }); }}>
                                          Introducir licencia
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { setLinkSearch(''); setLinkSelected(null); setLinkDialog({ key, name: p.name }); }}>
                                          Vincular a jugador sin licencia existente
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setConfirmNoLicense({ key, name: p.name })}>
                                          Confirmar jugador sin licencia
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>
                            Net oficial: <strong className="text-foreground">{pair.netPoints ?? '—'}</strong>
                          </span>
                          <span>Net calculado: {fourball?.calculatedNetPoints ?? '—'}</span>
                          <span>Brt oficial: {pair.grossPoints ?? '—'}</span>
                          <span>Brt calculado: {fourball?.calculatedGrossPoints ?? '—'}</span>
                        </div>
                      </div>

                      <Button variant="ghost" size="sm" className="self-start text-xs" onClick={() => toggle(row.index)}>
                        {isOpen ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}
                        Ver detalle
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>pairKey: {row.resolved.previewKey ?? '—'} ({pair.pairKeyKind})</span>
                          <span>Filas Excel: {pair.sourceRows.join(', ')}</span>
                        </div>

                        {(pair.errors.length > 0 || pair.warnings.length > 0 || pair.player1.warnings.length > 0 || pair.player2.warnings.length > 0 || (fourball?.warnings.length ?? 0) > 0) && (
                          <div className="space-y-1">
                            {pair.errors.map((e, i) => (
                              <div key={`e${i}`} className="text-destructive">• {e.message}</div>
                            ))}
                            {[...pair.warnings, ...pair.player1.warnings, ...pair.player2.warnings].map((w, i) => (
                              <div key={`w${i}`} className="text-muted-foreground">• {w.message}</div>
                            ))}
                            {fourball?.warnings.map((w, i) => (
                              <div key={`f${i}`} className="text-amber-600">• {w.message}</div>
                            ))}
                          </div>
                        )}

                        {fourball && (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-muted/40">
                                  <th className="border border-border px-1 py-1 text-left">Hoyo</th>
                                  {fourball.holes.map((h) => (
                                    <th key={h.hole} className="border border-border px-1 py-1">{h.hole}</th>
                                  ))}
                                  <th className="border border-border px-1 py-1">TOT</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-border px-1 py-1 text-muted-foreground">Par</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center text-muted-foreground">
                                      {h.par || '—'}
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1" />
                                </tr>
                                <tr>
                                  <td className="border border-border px-1 py-1">Golpes J1</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center">
                                      {h.player1.grossStrokes ?? '—'}
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1 text-center" />
                                </tr>
                                <tr>
                                  <td className="border border-border px-1 py-1">Stbf neto J1</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center">
                                      {h.player1.netPoints}
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1 text-center font-semibold">
                                    {fourball.playerNetPoints.player1 ?? '—'}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="border border-border px-1 py-1">Golpes J2</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center">
                                      {h.player2.grossStrokes ?? '—'}
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1 text-center" />
                                </tr>
                                <tr>
                                  <td className="border border-border px-1 py-1">Stbf neto J2</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center">
                                      {h.player2.netPoints}
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1 text-center font-semibold">
                                    {fourball.playerNetPoints.player2 ?? '—'}
                                  </td>
                                </tr>
                                <tr className="bg-muted/30 font-semibold">
                                  <td className="border border-border px-1 py-1">PAREJA</td>
                                  {fourball.holes.map((h) => (
                                    <td key={h.hole} className="border border-border px-1 py-1 text-center">
                                      {h.pairNetPoints}
                                      <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">
                                        {CONTRIB_MARK[h.netContributor]}
                                      </span>
                                    </td>
                                  ))}
                                  <td className="border border-border px-1 py-1 text-center">
                                    {fourball.calculatedNetPoints ?? '—'}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {fourball && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            <span>Net oficial: {fourball.officialNetPoints ?? '—'}</span>
                            <span>Net calculado: {fourball.calculatedNetPoints ?? '—'}</span>
                            <span>Diferencia: {fourball.netDifference ?? '—'}</span>
                            <span>Brt oficial: {fourball.officialGrossPoints ?? '—'}</span>
                            <span>Brt calculado: {fourball.calculatedGrossPoints ?? '—'}</span>
                            <span>Diferencia: {fourball.grossDifference ?? '—'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Import error */}
          {importError && (
            <div role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <X className="h-4 w-4" />
                No se ha podido importar
              </div>
              <p className="mt-1 text-muted-foreground">{importError}</p>
              <p className="mt-1 text-muted-foreground">
                No se ha guardado ningún cambio. Puedes corregir el archivo y volver a intentarlo.
              </p>
            </div>
          )}

          {/* Success summary */}
          {importResult && (
            <div className="rounded border border-emerald-600/40 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                Importación completada
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                <div>Jugadores creados: <strong>{importResult.playersCreated ?? 0}</strong></div>
                <div>Jugadores reutilizados: <strong>{importResult.playersMatched ?? 0}</strong></div>
                <div>Parejas creadas: <strong>{importResult.pairsCreated ?? 0}</strong></div>
                <div>Parejas reutilizadas: <strong>{importResult.pairsReused ?? 0}</strong></div>
                <div>Resultados insertados: <strong>{importResult.resultsInserted ?? 0}</strong></div>
                <div>Resultados actualizados: <strong>{importResult.resultsUpdated ?? 0}</strong></div>
                <div>Warnings: <strong>{importResult.warnings?.length ?? 0}</strong></div>
              </div>
              <p className="mt-2 text-muted-foreground">
                El resultado Net oficial del Excel se ha guardado correctamente.
              </p>
              {(importResult.warnings?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px]"
                    onClick={() => setWarningsOpen((v) => !v)}
                  >
                    {warningsOpen ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}
                    Ver detalle de warnings
                  </Button>
                  {warningsOpen && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11px] text-amber-700 dark:text-amber-400">
                      {importResult.warnings?.map((w, i) => (
                        <li key={i}>
                          {w.code ?? 'WARNING'} · {w.pairKey ?? '—'} · Net {w.netPoints ?? '—'} / Brt {w.grossPoints ?? '—'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="space-y-2 border-t border-border pt-3">
            {!summary.canImport && summary.blockers.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-muted-foreground">
                {summary.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                disabled={!canTriggerImport}
                className="w-full text-xs sm:w-auto"
                onClick={() => setConfirmOpen(true)}
              >
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importing ? 'IMPORTANDO…' : importResult ? 'IMPORTACIÓN COMPLETADA' : 'IMPORTAR RESULTADOS'}
              </Button>
              {!summary.canImport && (
                <span className="text-[11px] text-muted-foreground">
                  Resuelve los errores indicados para habilitar la importación.
                </span>
              )}
              {importResult ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs sm:ml-auto sm:w-auto"
                  onClick={handleFinish}
                >
                  CERRAR
                </Button>
              ) : (
                onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs sm:ml-auto sm:w-auto"
                    disabled={importing}
                    onClick={onClose}
                  >
                    Cerrar
                  </Button>
                )
              )}
            </div>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={(open) => !importing && setConfirmOpen(open)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar importación de parejas</AlertDialogTitle>
                <AlertDialogDescription>
                  Los resultados se importarán en una única operación. Si ocurre algún error, no se guardará ningún
                  cambio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div>Archivo: <strong>{fileName}</strong></div>
                <div>Jornada: <strong>{round?.name ?? '—'}</strong></div>
                <div>Parejas: <strong>{summary.detected}</strong></div>
                <div>Jugadores existentes: <strong>{summary.existingPlayers}</strong></div>
                <div>Jugadores nuevos: <strong>{summary.newPlayers}</strong></div>
                <div>Parejas existentes: <strong>{rows.filter((r) => r.pairExists).length}</strong></div>
                <div>Parejas nuevas: <strong>{rows.filter((r) => !r.pairExists).length}</strong></div>
                <div>Validación Fourball coincidente: <strong>{summary.netMatch}</strong></div>
                <div>Resultados con warnings: <strong>{summary.netMismatch + summary.weak}</strong></div>
              </div>
              {fourballWarningPending && (
                <p className="rounded border border-amber-600/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                  Hay validaciones Fourball pendientes o con diferencias. Esto no impide la importación porque el
                  resultado Net del Excel es la fuente oficial.
                </p>
              )}
              <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel disabled={importing} className="w-full sm:w-auto">
                  CANCELAR
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={importing}
                  className="w-full sm:w-auto"
                  onClick={(e) => {
                    e.preventDefault();
                    void runImport();
                  }}
                >
                  CONFIRMAR IMPORTACIÓN
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Introducir licencia */}
          <Dialog open={!!licenseDialog} onOpenChange={(o) => !o && setLicenseDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Introducir licencia</DialogTitle>
                <DialogDescription>{licenseDialog?.name}</DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                placeholder="Licencia federativa"
              />
              {licenseInput.trim() && !normalizePairLicense(licenseInput) && (
                <p className="text-[11px] text-destructive">Licencia no válida.</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setLicenseDialog(null)}>Cancelar</Button>
                <Button
                  disabled={!normalizePairLicense(licenseInput)}
                  onClick={() => {
                    if (!licenseDialog) return;
                    setResolution(licenseDialog.key, { kind: 'license', license: licenseInput });
                    setLicenseDialog(null);
                  }}
                >
                  Usar licencia
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmar sin licencia */}
          <AlertDialog open={!!confirmNoLicense} onOpenChange={(o) => !o && setConfirmNoLicense(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar jugador sin licencia</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmNoLicense?.name}: Confirma que este participante no dispone de licencia federativa. Se creará
                  como jugador sin licencia y podrá participar en esta competición.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (confirmNoLicense) setResolution(confirmNoLicense.key, { kind: 'no_license' });
                    setConfirmNoLicense(null);
                  }}
                >
                  Confirmar sin licencia
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Vincular a jugador sin licencia existente */}
          <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vincular a jugador sin licencia existente</DialogTitle>
                <DialogDescription>
                  {linkDialog?.name}. Solo se muestran jugadores confirmados sin licencia. El nombre sirve para
                  sugerir; debes elegir tú el jugador correcto.
                </DialogDescription>
              </DialogHeader>
              <Input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Buscar por nombre" />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {(() => {
                  const q = normalizeNameForSearch(linkSearch);
                  const list = rankUnlicensedCandidates(linkDialog?.name ?? '', unlicensedPlayers ?? []).filter(
                    (c) => !q || normalizeNameForSearch(c.name).includes(q),
                  );
                  if (list.length === 0) {
                    return <p className="text-xs text-muted-foreground">No hay jugadores sin licencia que coincidan.</p>;
                  }
                  return list.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs ${linkSelected === c.id ? 'border-primary' : 'border-border'}`}
                    >
                      <input type="radio" name="link-candidate" checked={linkSelected === c.id} onChange={() => setLinkSelected(c.id)} />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        · {c.gender ?? '—'} · HCP {c.current_handicap ?? '—'} · alta {new Date(c.created_at).toLocaleDateString('es-ES')} · {c.id.slice(0, 8)}
                      </span>
                    </label>
                  ));
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkDialog(null)}>Cancelar</Button>
                <Button
                  disabled={!linkSelected}
                  onClick={() => {
                    const c = unlicensedPlayers?.find((u) => u.id === linkSelected);
                    if (!linkDialog || !c) return;
                    setResolution(linkDialog.key, { kind: 'linked', playerId: c.id, playerName: c.name });
                    setLinkDialog(null);
                  }}
                >
                  Vincular
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </>
      )}
    </div>
  );
};

export default PairResultsImport;
