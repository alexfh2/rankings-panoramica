import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Check, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';

type Bilingual = { es?: string; en?: string };

type NewsRow = {
  id: string;
  date: string;
  title: Bilingual;
  body: Bilingual | null;
  image_url: string | null;
  url: string | null;
  published: boolean;
  sort: number;
};

type NewsForm = {
  id: string | null;
  date: string;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  imageUrl: string;
  url: string;
  published: boolean;
};

const BUCKET = 'photos';
const IMAGE_PREFIX = 'news/';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const emptyForm = (): NewsForm => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  titleEs: '',
  titleEn: '',
  bodyEs: '',
  bodyEn: '',
  imageUrl: '',
  url: '',
  published: false,
});

// Extrae la ruta dentro del bucket a partir de la URL pública almacenada.
const storagePathFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length);
  return path.startsWith(IMAGE_PREFIX) ? path : null;
};

const AdminNewsMembers = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<NewsForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsRow | null>(null);

  const { data: news, isLoading, error } = useQuery({
    queryKey: ['admin-news'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('news')
        .select('*')
        .order('date', { ascending: false })
        .order('sort', { ascending: false });
      if (error) throw error;
      return data as NewsRow[];
    },
  });

  const setField = <K extends keyof NewsForm>(key: K, value: NewsForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const openNew = () => setForm(emptyForm());

  const openEdit = (n: NewsRow) =>
    setForm({
      id: n.id,
      date: n.date,
      titleEs: n.title?.es ?? '',
      titleEn: n.title?.en ?? '',
      bodyEs: n.body?.es ?? '',
      bodyEn: n.body?.en ?? '',
      imageUrl: n.image_url ?? '',
      url: n.url ?? '',
      published: n.published,
    });

  const originalImage = useMemo(() => {
    if (!form?.id) return null;
    return (news ?? []).find((n) => n.id === form.id)?.image_url ?? null;
  }, [form?.id, news]);

  const uploadImage = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Formato no admitido',
        description: 'Usa una imagen JPG, PNG, WebP o AVIF.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: 'Imagen demasiado grande',
        description: 'El tamaño máximo es de 5 MB.',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${IMAGE_PREFIX}${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setField('imageUrl', data.publicUrl);
      toast({ title: 'Imagen subida' });
    } catch (err) {
      toast({
        title: 'Error al subir la imagen',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (f: NewsForm) => {
      if (!f.date) throw new Error('La fecha es obligatoria.');
      if (!f.titleEs.trim()) throw new Error('El título en castellano es obligatorio.');
      if (f.published && !f.titleEn.trim()) {
        throw new Error('Para publicar una noticia hace falta también el título en inglés.');
      }
      const payload = {
        date: f.date,
        title: { es: f.titleEs.trim(), en: f.titleEn.trim() },
        body:
          f.bodyEs.trim() || f.bodyEn.trim()
            ? { es: f.bodyEs.trim(), en: f.bodyEn.trim() }
            : null,
        image_url: f.imageUrl.trim() || null,
        url: f.url.trim() || null,
        published: f.published,
      };
      if (f.id) {
        const { error } = await (supabase.from as any)('news').update(payload).eq('id', f.id);
        if (error) throw error;
        // Si se ha sustituido o eliminado la imagen, borramos el archivo anterior.
        const oldPath = storagePathFromUrl(originalImage);
        if (oldPath && originalImage !== payload.image_url) {
          const stillUsed = (news ?? []).some(
            (n) => n.id !== f.id && n.image_url === originalImage,
          );
          if (!stillUsed) await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      } else {
        const { error } = await (supabase.from as any)('news').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-news'] });
      toast({ title: 'Noticia guardada correctamente' });
      setForm(null);
    },
    onError: (err: Error) => {
      // Mantenemos el formulario abierto con los valores introducidos.
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (n: NewsRow) => {
      const { error } = await (supabase.from as any)('news').delete().eq('id', n.id);
      if (error) throw error;
      const path = storagePathFromUrl(n.image_url);
      if (path) {
        const stillUsed = (news ?? []).some((o) => o.id !== n.id && o.image_url === n.image_url);
        if (!stillUsed) await supabase.storage.from(BUCKET).remove([path]);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-news'] });
      toast({ title: 'Noticia eliminada' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Actualidad</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Crea y publica las noticias de la sección de socios, en castellano e inglés.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva noticia
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando noticias…
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            No se han podido cargar las noticias: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && news?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay noticias. Crea la primera con “Nueva noticia”.
        </p>
      )}

      <div className="space-y-2">
        {(news ?? []).map((n) => (
          <Card key={n.id}>
            <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
              {n.image_url ? (
                <img
                  src={n.image_url}
                  alt={n.title?.es ? `Imagen de ${n.title.es}` : 'Imagen de la noticia'}
                  loading="lazy"
                  className="h-12 w-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-16 rounded bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {n.title?.es || <span className="italic text-muted-foreground">sin título</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${n.date}T00:00:00`).toLocaleDateString('es-ES')}
                </p>
              </div>
              <Badge variant={n.published ? 'default' : 'secondary'}>
                {n.published ? 'Publicada' : 'Borrador'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => openEdit(n)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(n)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar noticia' : 'Nueva noticia'}</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField('date', e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Label htmlFor="news-published" className="text-sm mb-2">
                    Publicada
                  </Label>
                  <Switch
                    id="news-published"
                    className="mb-2"
                    checked={form.published}
                    onCheckedChange={(v) => setField('published', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título (ES)</Label>
                  <Input
                    value={form.titleEs}
                    onChange={(e) => setField('titleEs', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título (EN)</Label>
                  <Input
                    value={form.titleEn}
                    onChange={(e) => setField('titleEn', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Texto (ES)</Label>
                  <Textarea
                    rows={8}
                    value={form.bodyEs}
                    onChange={(e) => setField('bodyEs', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Texto (EN)</Label>
                  <Textarea
                    rows={8}
                    value={form.bodyEn}
                    onChange={(e) => setField('bodyEn', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Imagen</Label>
                {form.imageUrl ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <img
                      src={form.imageUrl}
                      alt="Vista previa de la imagen de la noticia"
                      className="h-20 w-28 rounded object-cover"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setField('imageUrl', '')}
                      disabled={uploading}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Quitar imagen
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin imagen</p>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) uploadImage(file);
                    }}
                    className="max-w-xs"
                  />
                  {uploading ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…
                    </span>
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG, WebP o AVIF · máximo 5 MB
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Enlace (opcional)</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setField('url', e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm(null)}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => form && saveMutation.mutate(form)}
              disabled={saveMutation.isPending || uploading}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta noticia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará “{deleteTarget?.title?.es || 'sin título'}” y su imagen. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
              disabled={deleteMutation.isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminNewsMembers;
