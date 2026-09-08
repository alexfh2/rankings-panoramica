import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import AdminSchoolRates from '@/components/admin/AdminSchoolRates';


type RateRow = {
  id: string;
  code: string;
  group: string;
  sort: number;
  label: { es?: string; en?: string };
  meta: { es?: string; en?: string };
  custom: { es?: string; en?: string };
  amount: number | null;
  amount_alt: number | null;
  suffix: { es?: string; en?: string } | string | null;
  active: boolean;
};

type RateEdit = {
  labelEs: string;
  labelEn: string;
  metaEs: string;
  metaEn: string;
  amount: string;
  amountAlt: string;
  suffix: string;
  suffixEn: string;
  customEs: string;
  customEn: string;
  active: boolean;
};

const GROUP_LABELS: Record<string, string> = {
  green_fees: 'Green Fees',
  servicios: 'Servicios',
  pass_resident: 'Golf Pass Resident',
  bonos: 'Bonos',
  custodia: 'Custodia',
  golf_pass: 'Golf Pass',
};

const GROUP_ORDER = ['green_fees', 'servicios', 'pass_resident', 'bonos', 'custodia', 'golf_pass'];

const suffixEs = (s: RateRow['suffix']): string =>
  typeof s === 'string' ? s : s?.es ?? '';

const parseAmount = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
};

const AdminRates = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<RateEdit | null>(null);

  const { data: rates, isLoading, error } = useQuery({
    queryKey: ['admin-rates'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('rates')
        .select('*')
        .order('group')
        .order('sort');
      if (error) throw error;
      return data as RateRow[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, RateRow[]>();
    (rates ?? []).forEach((r) => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((k) => ({
      key: k,
      label: GROUP_LABELS[k] ?? k,
      items: map.get(k)!,
    }));
  }, [rates]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: RateEdit }) => {
      const amount = parseAmount(form.amount);
      const amountAlt = parseAmount(form.amountAlt);
      if (Number.isNaN(amount) || Number.isNaN(amountAlt)) {
        throw new Error('Los importes deben ser numéricos (o dejarse vacíos).');
      }
      if (!form.labelEs.trim()) {
        throw new Error('El nombre (ES) no puede estar vacío.');
      }
      const payload = {
        label: { es: form.labelEs.trim(), en: form.labelEn.trim() },
        meta: { es: form.metaEs.trim(), en: form.metaEn.trim() },
        custom: { es: form.customEs.trim(), en: form.customEn.trim() },
        amount,
        amount_alt: amountAlt,
        suffix: form.suffix.trim()
          ? { es: form.suffix.trim(), en: form.suffixEn.trim() || form.suffix.trim() }
          : null,
        active: form.active,
      };
      const { error } = await (supabase.from as any)('rates').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rates'] });
      toast({ title: 'Tarifa guardada correctamente' });
      setEditingId(null);
      setEdit(null);
    },
    onError: (err: Error) => {
      // No cerramos el formulario: los valores introducidos se conservan.
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
  });

  const startEdit = (r: RateRow) => {
    setEditingId(r.id);
    setEdit({
      labelEs: r.label?.es ?? '',
      labelEn: r.label?.en ?? '',
      metaEs: r.meta?.es ?? '',
      metaEn: r.meta?.en ?? '',
      amount: r.amount?.toString() ?? '',
      amountAlt: r.amount_alt?.toString() ?? '',
      suffix: suffixEs(r.suffix),
      suffixEn: typeof r.suffix === 'string' ? '' : r.suffix?.en ?? '',
      customEs: r.custom?.es ?? '',
      customEn: r.custom?.en ?? '',
      active: r.active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const setField = <K extends keyof RateEdit>(key: K, value: RateEdit[K]) =>
    setEdit((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Tarifas</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Edita las tarifas publicadas en la web. Solo se puede modificar el contenido de las
          tarifas existentes.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tarifas…
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            No se han podido cargar las tarifas: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && rates?.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay tarifas registradas todavía.</p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="font-display text-lg font-semibold">{g.label}</h2>
          <div className="space-y-2">
            {g.items.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <Card key={r.id} className={!r.active ? 'opacity-70' : undefined}>
                  <CardContent className="py-3 px-4">
                    {!isEditing ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.label?.es || <span className="italic text-muted-foreground">sin nombre</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.meta?.es || ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 font-mono mt-0.5">
                            {r.code}
                          </p>
                        </div>
                        <div className="admin-amount text-lg whitespace-nowrap">
                          {r.amount != null ? `${r.amount} €` : '—'}
                          {suffixEs(r.suffix) ? <span className="text-xs text-muted-foreground ml-1">{suffixEs(r.suffix)}</span> : null}
                        </div>
                        <Badge variant={r.active ? 'default' : 'secondary'} className={r.active ? 'admin-pill-published' : 'admin-pill-draft'}>
                          {r.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      </div>
                    ) : (
                      edit && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs text-muted-foreground font-mono">
                              {r.code} · {GROUP_LABELS[r.group] ?? r.group}
                            </p>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`active-${r.id}`} className="text-sm">
                                Activa
                              </Label>
                              <Switch
                                id={`active-${r.id}`}
                                checked={edit.active}
                                onCheckedChange={(v) => setField('active', v)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nombre (ES)</Label>
                              <Input
                                value={edit.labelEs}
                                onChange={(e) => setField('labelEs', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Nombre (EN)</Label>
                              <Input
                                value={edit.labelEn}
                                onChange={(e) => setField('labelEn', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Descripción (ES)</Label>
                              <Input
                                value={edit.metaEs}
                                onChange={(e) => setField('metaEs', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Descripción (EN)</Label>
                              <Input
                                value={edit.metaEn}
                                onChange={(e) => setField('metaEn', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Precio (€)</Label>
                              <Input
                                inputMode="decimal"
                                value={edit.amount}
                                onChange={(e) => setField('amount', e.target.value)}
                                placeholder="Ej. 45"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Precio alternativo (€)</Label>
                              <Input
                                inputMode="decimal"
                                value={edit.amountAlt}
                                onChange={(e) => setField('amountAlt', e.target.value)}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Sufijo (ES)</Label>
                              <Input
                                value={edit.suffix}
                                onChange={(e) => setField('suffix', e.target.value)}
                                placeholder="Ej. /persona"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Sufijo (EN)</Label>
                              <Input
                                value={edit.suffixEn}
                                onChange={(e) => setField('suffixEn', e.target.value)}
                                placeholder="Ej. /person"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Texto personalizado (ES)</Label>
                              <Input
                                value={edit.customEs}
                                onChange={(e) => setField('customEs', e.target.value)}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="space-y-1 md:col-start-2">
                              <Label className="text-xs">Texto personalizado (EN)</Label>
                              <Input
                                value={edit.customEn}
                                onChange={(e) => setField('customEn', e.target.value)}
                                placeholder="Opcional"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              disabled={updateMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateMutation.mutate({ id: r.id, form: edit })}
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                              )}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <AdminSchoolRates />
    </div>

  );
};

export default AdminRates;
