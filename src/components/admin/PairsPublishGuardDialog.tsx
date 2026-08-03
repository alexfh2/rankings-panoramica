/**
 * Diálogo de control previo a publicar una jornada de Parejas.
 * Solo presentación: no escribe en la base de datos ni recalcula resultados.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type {
  PairValidationEntry,
  PairsRoundValidationSummary,
} from '@/lib/validatePairsRoundPublication';

export type PairsPublishGuardState =
  | { phase: 'validating' }
  | { phase: 'error'; message: string }
  | { phase: 'result'; summary: PairsRoundValidationSummary };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PairsPublishGuardState | null;
  isPublishing: boolean;
  onConfirm: () => void;
};

const STATUS_STYLE: Record<PairValidationEntry['status'], string> = {
  valid: 'text-emerald-700',
  mismatch: 'text-[#A8543A]',
  provisional: 'text-[#9A7B3F]',
  insufficient_data: 'text-muted-foreground',
};

const STATUS_LABEL: Record<PairValidationEntry['status'], string> = {
  valid: 'Validada',
  mismatch: 'Discrepancia',
  provisional: 'Provisional',
  insufficient_data: 'Sin datos suficientes',
};

const SummaryCounts = ({ summary }: { summary: PairsRoundValidationSummary }) => (
  <ul className="text-xs text-muted-foreground space-y-1">
    <li>
      <span className={STATUS_STYLE.valid}>Parejas validadas</span>: {summary.valid.length}
    </li>
    <li>
      <span className={STATUS_STYLE.mismatch}>Parejas con discrepancia</span>: {summary.mismatch.length}
    </li>
    <li>
      <span className={STATUS_STYLE.provisional}>Parejas con validación provisional</span>:{' '}
      {summary.provisional.length}
    </li>
    <li>
      <span className={STATUS_STYLE.insufficient_data}>Parejas sin datos suficientes</span>:{' '}
      {summary.insufficientData.length}
    </li>
  </ul>
);

const PairsPublishGuardDialog = ({ open, onOpenChange, state, isPublishing, onConfirm }: Props) => {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  const body = () => {
    if (!state || state.phase === 'validating') {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Validando…</DialogTitle>
            <DialogDescription>
              Comprobando los resultados Fourball de la jornada. No se ha modificado nada todavía.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> VALIDANDO…
          </div>
        </>
      );
    }

    if (state.phase === 'error') {
      return (
        <>
          <DialogHeader>
            <DialogTitle>No se ha podido validar la jornada</DialogTitle>
            <DialogDescription>
              No se ha podido validar la jornada. No se ha realizado ningún cambio.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground break-words">{state.message}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              TANCAR
            </Button>
          </DialogFooter>
        </>
      );
    }

    const { summary } = state;

    if (summary.mismatch.length > 0) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>No se puede publicar la jornada</DialogTitle>
            <DialogDescription>
              Hay resultados Fourball cuyo cálculo no coincide con el Net oficial del Excel. Revisa los
              resultados antes de publicar.
            </DialogDescription>
          </DialogHeader>
          <SummaryCounts summary={summary} />
          <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
            {summary.mismatch.map((e) => (
              <div key={e.resultId} className="p-3 text-xs">
                <div className="font-semibold">{e.pairName}</div>
                <div className="text-muted-foreground">
                  Net oficial {e.officialNetPoints} · Net calculado {e.calculatedNetPoints ?? '—'} ·
                  Diferencia {e.netDifference ?? '—'}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              VOLVER A REVISAR
            </Button>
          </DialogFooter>
        </>
      );
    }

    if (summary.requiresConfirmation) {
      const pending = [...summary.provisional, ...summary.insufficientData];
      return (
        <>
          <DialogHeader>
            <DialogTitle>Publicar con validaciones pendientes</DialogTitle>
            <DialogDescription>
              Algunos resultados no se han podido comprobar hoyo a hoyo porque faltan datos completos. El Net
              oficial del Excel se utilizará para la clasificación.
            </DialogDescription>
          </DialogHeader>
          <SummaryCounts summary={summary} />
          <p className="text-xs text-muted-foreground">Parejas afectadas: {pending.length}</p>
          <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
            {pending.map((e) => (
              <div key={e.resultId} className="p-3 text-xs">
                <div className="font-semibold">{e.pairName}</div>
                <div className={STATUS_STYLE[e.status]}>
                  {STATUS_LABEL[e.status]} · {e.reason}
                </div>
                <div className="text-muted-foreground">Net oficial {e.officialNetPoints}</div>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>He revisado el Excel y confirmo que el Net oficial es correcto.</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
              CANCELAR
            </Button>
            <Button onClick={onConfirm} disabled={!confirmed || isPublishing}>
              {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              PUBLICAR JORNADA
            </Button>
          </DialogFooter>
        </>
      );
    }

    return (
      <>
        <DialogHeader>
          <DialogTitle>Publicar jornada</DialogTitle>
          <DialogDescription>Todos los resultados Fourball se han validado correctamente.</DialogDescription>
        </DialogHeader>
        <SummaryCounts summary={summary} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            CANCELAR
          </Button>
          <Button onClick={onConfirm} disabled={isPublishing}>
            {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            PUBLICAR JORNADA
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">{body()}</DialogContent>
    </Dialog>
  );
};

export default PairsPublishGuardDialog;
