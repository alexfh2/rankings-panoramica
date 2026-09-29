import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { ChevronDown, ImageOff, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  PROMO_ACCEPT,
  PROMO_BUCKET,
  PROMO_FOLDER,
  PROMO_IMAGE_FIELDS,
  PROMO_MAX_BYTES,
  PromoImageField,
  PromoStatus,
  isValidUrl,
  madridToday,
  promoStatus,
  storagePathFromUrl,
} from '@/lib/promotions';

type Alt = { es?: string; en?: string; fr?: string };

export type PromotionRow = {
  id: string;
  active: boolean;
  start_date: string;
  end_date: string | null;
  image_desktop_url: string | null;
  image_mobile_url: string | null;
  image_desktop_url_en: string | null;
  image_mobile_url_en: string | null;
  image_desktop_url_fr: string | null;
  image_mobile_url_fr: string | null;
  link_url: string | null;
  alt: Alt | null;
  sort: number;
  images_purged_at: string | null;
  created_at: string;
};

type FormState = {
  id?: string;
  active: boolean;
  start_date: string;
  end_date: string;
  link_url: string;
  alt: Alt;
  sort: number;
  images: Record<PromoImageField, string | null>;
  purged: boolean;
};

const emptyImages = (): Record<PromoImageField, string | null> =>
  Object.fromEntries(PROMO_IMAGE_FIELDS.map((f) => [f, null])) as Record<PromoImageField, string | null>;

const emptyForm = (): FormState => ({
  active: false,
  start_date: madridToday(),
  end_date: '',
  link_url: '',
  alt: {},
  sort: 0,
  images: emptyImages(),
  purged: false,
});

const toForm = (p: PromotionRow): FormState => ({
  id: p.id,
  active: p.active,
  start_date: p.start_date,
  end_date: p.end_date ?? '',
  link_url: p.link_url ?? '',
  alt: (p.alt as Alt) ?? {},
  sort: p.sort,
  images: Object.fromEntries(PROMO_IMAGE_FIELDS.map((f) => [f, p[f]])) as Record<PromoImageField, string | null>,
  purged: !!p.images_purged_at,
});

const STATUS_ORDER: Record<PromoStatus, number> = { vigente: 0, programada: 1, caducada: 2 };
const STATUS_LABEL: Record<PromoStatus, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  caducada: 'Caducada',
};

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fin';

const StatusBadge = ({ status }: { status: PromoStatus }) => (
  <Badge
    variant="outline"
    className={
      status === 'vigente'
        ? 'admin-pill-published'
        : status === 'programada'
          ? 'admin-pill-draft'
          : 'admin-pill-draft opacity-60'
    }
  >
    {STATUS_LABEL[status]}
  </Badge>
);

const ImageSlot = ({
  label,
  ratio,
  value,
  uploading,
  onPick,
  onClear,
}: {
  label: string;
  ratio: 'desktop' | 'mobile';
  value: string | null;
  uploading: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) => (
  <div className="space-y-2">
    <Label className="admin-card-label">{label}</Label>
    <div
      className={`relative border border-dashed overflow-hidden bg-background/40 ${
        ratio === 'desktop' ? 'aspect-[16/9]' : 'aspect-[4/5] max-w-[220px]'
      }`}
    >
      {value ? (
        <>
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 bg-background/80 p-1"
            aria-label="Quitar imagen"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground text-xs">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {uploading ? 'Subiendo…' : 'Subir imagen'}
          <input
            type="file"
            accept={PROMO_ACCEPT.join(',')}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  </div>
);

const AdminPromotions = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [originalImages, setOriginalImages] = useState<Record<PromoImageField, string | null>>(emptyImages());
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploading, setUploading] = useState<PromoImageField | null>(null);
  const [saving, setSaving] = useState(false);
  const [futureWarn, setFutureWarn] = useState(false);
  const [toDelete, setToDelete] = useState<PromotionRow | null>(null);
  const [purging, setPurging] = useState(false);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('promotions').select('*');
      if (error) throw error;
      return data as unknown as PromotionRow[];
    },
  });

  const today = madridToday();
  const sorted = [...promos].sort((a, b) => {
    const s = STATUS_ORDER[promoStatus(a, today)] - STATUS_ORDER[promoStatus(b, today)];
    if (s !== 0) return s;
    return b.start_date.localeCompare(a.start_date);
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-promotions'] });
    qc.invalidateQueries({ queryKey: ['admin-promotions-stats'] });
  };

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openNew = () => {
    setForm(emptyForm());
    setOriginalImages(emptyImages());
    setUploaded([]);
  };
  const openEdit = (p: PromotionRow) => {
    const f = toForm(p);
    setForm(f);
    setOriginalImages({ ...f.images });
    setUploaded([]);
  };

  const closeForm = async () => {
    // Remove files uploaded in this session that were not saved
    const orphan = uploaded.map(storagePathFromUrl).filter((p): p is string => !!p);
    if (orphan.length) await supabase.storage.from(PROMO_BUCKET).remove(orphan);
    setForm(null);
    setUploaded([]);
  };

  const uploadImage = async (field: PromoImageField, file: File) => {
    if (!PROMO_ACCEPT.includes(file.type)) {
      toast({ title: 'Formato no válido', description: 'Solo JPG, PNG o WebP.', variant: 'destructive' });
      return;
    }
    if (file.size > PROMO_MAX_BYTES) {
      toast({ title: 'Archivo demasiado grande', description: 'Máximo 2 MB por imagen.', variant: 'destructive' });
      return;
    }
    setUploading(field);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${PROMO_FOLDER}/${crypto.randomUUID()}-${field}.${ext}`;
      const { error } = await supabase.storage
        .from(PROMO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(PROMO_BUCKET).getPublicUrl(path);
      setUploaded((u) => [...u, data.publicUrl]);
      setForm((f) => (f ? { ...f, images: { ...f.images, [field]: data.publicUrl } } : f));
    } catch (e) {
      toast({ title: 'Error al subir', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const validate = (f: FormState): string | null => {
    if (!f.start_date) return 'La fecha de inicio es obligatoria.';
    if (f.end_date && f.end_date < f.start_date) return 'La fecha de fin no puede ser anterior a la de inicio.';
    if (!f.images.image_desktop_url && !f.images.image_mobile_url)
      return 'Tiene que haber al menos una imagen en español (horizontal o vertical).';
    if (f.link_url.trim() && !isValidUrl(f.link_url.trim())) return 'El enlace debe ser una URL válida (https://…).';
    return null;
  };

  const requestSave = () => {
    if (!form) return;
    const err = validate(form);
    if (err) {
      toast({ title: 'Revisa el formulario', description: err, variant: 'destructive' });
      return;
    }
    if (form.active && form.start_date > madridToday()) {
      setFutureWarn(true);
      return;
    }
    void save();
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const alt: Alt = {};
      (['es', 'en', 'fr'] as const).forEach((l) => {
        const v = form.alt[l]?.trim();
        if (v) alt[l] = v;
      });
      const payload = {
        active: form.active,
        start_date: form.start_date,
        end_date: form.end_date || null,
        link_url: form.link_url.trim() || null,
        alt: Object.keys(alt).length ? alt : null,
        sort: Number.isFinite(form.sort) ? form.sort : 0,
        ...form.images,
        ...(form.purged ? { images_purged_at: null } : {}),
      };
      const { error } = form.id
        ? await supabase.from('promotions').update(payload).eq('id', form.id)
        : await supabase.from('promotions').insert(payload);
      if (error) throw error;

      // Remove replaced/cleared original images
      const replaced = PROMO_IMAGE_FIELDS.filter((f) => originalImages[f] && originalImages[f] !== form.images[f])
        .map((f) => storagePathFromUrl(originalImages[f]))
        .filter((p): p is string => !!p);
      // Remove uploaded-but-discarded files from this session
      const kept = new Set(Object.values(form.images));
      const discarded = uploaded.filter((u) => !kept.has(u)).map(storagePathFromUrl).filter((p): p is string => !!p);
      const toRemove = [...replaced, ...discarded];
      if (toRemove.length) await supabase.storage.from(PROMO_BUCKET).remove(toRemove);

      toast({ title: form.id ? 'Promoción actualizada' : 'Promoción creada' });
      setUploaded([]);
      setForm(null);
      invalidate();
    } catch (e) {
      toast({ title: 'Error al guardar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setFutureWarn(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const paths = PROMO_IMAGE_FIELDS.map((f) => storagePathFromUrl(toDelete[f])).filter((p): p is string => !!p);
    const { error } = await supabase.from('promotions').delete().eq('id', toDelete.id);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    if (paths.length) await supabase.storage.from(PROMO_BUCKET).remove(paths);
    toast({ title: 'Promoción eliminada' });
    setToDelete(null);
    invalidate();
  };

  const purgeNow = async () => {
    setPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke('purge-promotion-images', { body: { source: 'manual' } });
      if (error) throw error;
      toast({
        title: 'Limpieza completada',
        description: `${data?.cleaned ?? 0} promociones caducadas limpiadas.`,
      });
      invalidate();
    } catch (e) {
      toast({ title: 'Error en la limpieza', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPurging(false);
    }
  };

  const setImg = (field: PromoImageField, v: string | null) =>
    setForm((f) => (f ? { ...f, images: { ...f.images, [field]: v } } : f));

  const imagePair = (suffix: '' | '_en' | '_fr', lang: string) => {
    const d = `image_desktop_url${suffix}` as PromoImageField;
    const m = `image_mobile_url${suffix}` as PromoImageField;
    return (
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <ImageSlot
          label={`Horizontal · ${lang}`}
          ratio="desktop"
          value={form!.images[d]}
          uploading={uploading === d}
          onPick={(file) => uploadImage(d, file)}
          onClear={() => setImg(d, null)}
        />
        <ImageSlot
          label={`Vertical · ${lang}`}
          ratio="mobile"
          value={form!.images[m]}
          uploading={uploading === m}
          onPick={(file) => uploadImage(m, file)}
          onClear={() => setImg(m, null)}
        />
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="admin-eyebrow mb-2">Web pública</p>
          <h1 className="admin-page-title">Promociones</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={purgeNow} disabled={purging}>
            {purging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Limpiar ahora las caducadas
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva promoción
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">Todavía no hay promociones.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => {
            const status = promoStatus(p, today);
            const thumb = p.image_desktop_url || p.image_mobile_url;
            return (
              <Card key={p.id} className="admin-metric-card">
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="w-32 aspect-[16/9] shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                    {p.images_purged_at || !thumb ? (
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <img src={thumb} alt={(p.alt as Alt)?.es ?? ''} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={status} />
                      {p.images_purged_at && (
                        <span className="text-xs text-muted-foreground">imágenes borradas</span>
                      )}
                      {!p.active && !p.images_purged_at && (
                        <span className="text-xs text-muted-foreground">desactivada</span>
                      )}
                    </div>
                    <p className="text-sm">
                      {fmtDate(p.start_date)} — {fmtDate(p.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[360px]">
                      {p.link_url || 'Sin enlace'} · Orden {p.sort}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`act-${p.id}`} className="text-xs text-muted-foreground">
                      Activa
                    </Label>
                    <Switch
                      id={`act-${p.id}`}
                      checked={p.active}
                      disabled={!!p.images_purged_at}
                      onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(p)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="admin-shell max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form?.id ? 'Editar promoción' : 'Nueva promoción'}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-6">
              {form.purged && (
                <div className="border border-dashed p-3 text-sm text-muted-foreground">
                  Las imágenes de esta promoción se borraron automáticamente al caducar. Para reutilizarla hay que
                  volver a subir las imágenes.
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Horizontal 1600x900 px · Vertical 1080x1350 px · JPG, menos de 400 KB
                </p>
                {imagePair('', 'Español')}
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between border-t pt-4 text-left text-sm">
                  <span>
                    <span className="admin-card-label block mb-1">Inglés y francés</span>
                    <span className="text-muted-foreground text-xs">
                      Si no subes imagen para un idioma, se muestra la española
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 pt-4">
                  {imagePair('_en', 'Inglés')}
                  {imagePair('_fr', 'Francés')}
                </CollapsibleContent>
              </Collapsible>

              <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
                <div className="space-y-2">
                  <Label className="admin-card-label">Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="admin-card-label">Fecha de fin</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Vacío = sin fecha de fin</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="admin-card-label">Enlace (opcional)</Label>
                <Input
                  type="url"
                  placeholder="https://"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="admin-card-label">Texto alternativo</Label>
                <p className="text-xs text-muted-foreground">
                  Describe la oferta en una frase, lo leen los lectores de pantalla
                </p>
                {(['es', 'en', 'fr'] as const).map((l) => (
                  <Input
                    key={l}
                    placeholder={l === 'es' ? 'Español' : l === 'en' ? 'Inglés' : 'Francés'}
                    value={form.alt[l] ?? ''}
                    onChange={(e) => setForm({ ...form, alt: { ...form.alt, [l]: e.target.value } })}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-6 border-t pt-4">
                <div className="space-y-2 w-28">
                  <Label className="admin-card-label">Orden</Label>
                  <Input
                    type="number"
                    value={form.sort}
                    onChange={(e) => setForm({ ...form, sort: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label>Activa</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={requestSave} disabled={saving || !!uploading}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={futureWarn} onOpenChange={setFutureWarn}>
        <AlertDialogContent className="admin-shell">
          <AlertDialogHeader>
            <AlertDialogTitle>La promoción aún no se verá</AlertDialogTitle>
            <AlertDialogDescription>
              Está activa pero empieza el {form ? fmtDate(form.start_date) : ''}. No aparecerá en la web hasta ese día.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>Guardar igualmente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="admin-shell">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar promoción</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará la promoción y todas sus imágenes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPromotions;
