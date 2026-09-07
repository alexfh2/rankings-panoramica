import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2 } from 'lucide-react';

type SchoolRateRow = {
  id: string;
  pax: number | null;
  audience: 'socio' | 'no_socio' | null;
  segment: 'ninos' | 'adultos' | null;
  product: 'clase' | 'bono_5h' | 'bono_10h' | 'campo' | 'iniciacion';
  amount: number;
  sort: number;
};

const LESSON_PRODUCTS: Array<{ key: SchoolRateRow['product']; label: string }> = [
  { key: 'clase', label: '1 clase' },
  { key: 'bono_5h', label: 'Bono 5h' },
  { key: 'bono_10h', label: 'Bono 10h' },
];

const parseAmount = (value: string): number => {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const AdminSchoolRates = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['admin-school-rates'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('school_rates')
        .select('*')
        .order('sort');
      if (error) throw error;
      return data as SchoolRateRow[];
    },
  });

  // Base values from the database, used to detect which cells changed.
  const base = useMemo(() => {
    const map: Record<string, string> = {};
    (rows ?? []).forEach((r) => {
      map[r.id] = String(r.amount);
    });
    return map;
  }, [rows]);

  useEffect(() => {
    if (rows) setDrafts((prev) => ({ ...base, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const find = (
    product: SchoolRateRow['product'],
    opts: { pax?: number; audience?: SchoolRateRow['audience']; segment?: SchoolRateRow['segment'] },
  ) =>
    (rows ?? []).find(
      (r) =>
        r.product === product &&
        (opts.pax === undefined || r.pax === opts.pax) &&
        (opts.audience === undefined || r.audience === opts.audience) &&
        (opts.segment === undefined || r.segment === opts.segment),
    );

  const changedIds = useMemo(
    () => Object.keys(drafts).filter((id) => base[id] !== undefined && drafts[id] !== base[id]),
    [drafts, base],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = changedIds.map((id) => ({ id, amount: parseAmount(drafts[id]) }));
      if (updates.some((u) => Number.isNaN(u.amount))) {
        throw new Error('Todos los precios deben ser números iguales o mayores que 0.');
      }
      const failed: string[] = [];
      for (const u of updates) {
        const { error } = await (supabase.from as any)('school_rates')
          .update({ amount: u.amount })
          .eq('id', u.id);
        if (error) failed.push(error.message);
      }
      if (failed.length > 0) {
        throw new Error(
          `No se han podido guardar ${failed.length} de ${updates.length} precios: ${failed[0]}`,
        );
      }
      return updates.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['admin-school-rates'] });
      toast({ title: `Escuela guardada (${count} ${count === 1 ? 'precio' : 'precios'})` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error al guardar Escuela', description: err.message, variant: 'destructive' });
      qc.invalidateQueries({ queryKey: ['admin-school-rates'] });
    },
  });

  const cell = (row: SchoolRateRow | undefined) => {
    if (!row) return <span className="text-muted-foreground text-sm">—</span>;
    const value = drafts[row.id] ?? String(row.amount);
    const dirty = base[row.id] !== undefined && value !== base[row.id];
    return (
      <div className="relative">
        <Input
          inputMode="decimal"
          className={`h-9 w-full min-w-[68px] pr-6 text-sm ${dirty ? 'border-primary' : ''}`}
          value={value}
          onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
          aria-label={`Precio ${row.product} ${row.pax ?? ''} ${row.audience ?? row.segment ?? ''}`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          €
        </span>
      </div>
    );
  };

  const lessonTable = (audience: 'socio' | 'no_socio', title: string) => (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Personas</th>
              {LESSON_PRODUCTS.map((p) => (
                <th key={p.key} className="py-1 px-2 font-medium">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((pax) => (
              <tr key={pax} className="border-t border-border/60">
                <td className="py-2 pr-2 whitespace-nowrap">
                  {pax} {pax === 1 ? 'persona' : 'personas'}
                </td>
                {LESSON_PRODUCTS.map((p) => (
                  <td key={p.key} className="py-2 px-2">
                    {cell(find(p.key, { pax, audience }))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold">Escuela</h2>
          <p className="text-xs text-muted-foreground">
            Solo se pueden editar los precios. No se pueden crear ni eliminar tarifas de Escuela.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || changedIds.length === 0}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 mr-1" />
          )}
          {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios de Escuela'}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tarifas de Escuela…
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            No se han podido cargar las tarifas de Escuela: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 px-4 space-y-6">
              <p className="text-sm font-medium">Clases y bonos</p>
              {lessonTable('socio', 'Socios')}
              {lessonTable('no_socio', 'No socios')}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Clase de campo</p>
                <p className="text-xs text-muted-foreground">Incluye Green Fee</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[300px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-2 font-medium">Personas</th>
                      <th className="py-1 px-2 font-medium">Socio</th>
                      <th className="py-1 px-2 font-medium">No socio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((pax) => (
                      <tr key={pax} className="border-t border-border/60">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {pax} {pax === 1 ? 'persona' : 'personas'}
                        </td>
                        <td className="py-2 px-2">{cell(find('campo', { pax, audience: 'socio' }))}</td>
                        <td className="py-2 px-2">
                          {cell(find('campo', { pax, audience: 'no_socio' }))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Iniciación en grupo</p>
                <p className="text-xs text-muted-foreground">1 hora · Mínimo 4 personas</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <div className="space-y-1">
                  <Label className="text-xs">Niños</Label>
                  {cell(find('iniciacion', { segment: 'ninos' }))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Adultos</Label>
                  {cell(find('iniciacion', { segment: 'adultos' }))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
};

export default AdminSchoolRates;
