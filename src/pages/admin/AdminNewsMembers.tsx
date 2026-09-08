import { useState } from 'react';
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
import { ArrowLeft, ArrowRight, Check, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';

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

type NewsImageRow = {
  id: string;
  news_id: string;
  storage_path: string;
  image_url: string;
  sort: number;
};

type NewsForm = {
  id: string | null;
  date: string;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  url: string;
  published: boolean;
};

const BUCKET = 'photos';
const IMAGE_PREFIX = 'news/';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const emptyForm = (): NewsForm => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  titleEs: '',
  titleEn: '',
  bodyEs: '',
  bodyEn: '',
  url: '',
  published: false,
});

// Wrapper con la llamada vinculada al cliente: extraer `supabase.from` suelto
// rompe el `this` interno ("Cannot read properties of undefined (reading 'rest')").
const db = (table: string): any => supabase.from(table as any);

// Normaliza los sort a 10, 20, 30... y sincroniza la portada en news.image_url.
const normalizeAndSyncCover = async (newsId: string) => {
  const { data, error } = await db('news_images')
    .select('id, sort, image_url')
    .eq('news_id', newsId)
    .order('sort', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as NewsImageRow[];
  for (let i = 0; i < rows.length; i += 1) {
    const target = (i + 1) * 10;
    if (rows[i].sort !== target) {
      const { error: upErr } = await db('news_images')
        .update({ sort: target })
        .eq('id', rows[i].id);
      if (upErr) throw upErr;
    }
  }
  const cover = rows[0]?.image_url ?? null;
  const { error: newsErr } = await db('news').update({ image_url: cover }).eq('id', newsId);
  if (newsErr) throw newsErr;
};

const AdminNewsMembers = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<NewsForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsRow | null>(null);

  const { data: news, isLoading, error } = useQuery({
    queryKey: ['admin-news'],
    queryFn: async () => {
      const { data, error } = await db('news')
        .select('*')
        .order('date', { ascending: false })
        .order('sort', { ascending: false });
      if (error) throw error;
      return data as NewsRow[];
    },
  });

  const newsId = form?.id ?? null;

  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['admin-news-images', newsId],
    enabled: !!newsId,
    queryFn: async () => {
      const { data, error } = await db('news_images')
        .select('*')
        .eq('news_id', newsId)
        .order('sort', { ascending: true });
      if (error) throw error;
      return data as NewsImageRow[];
    },
  });

  const imageList = images ?? [];

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
      url: n.url ?? '',
      published: n.published,
    });

  const refreshImages = async (id: string) => {
    await qc.invalidateQueries({ queryKey: ['admin-news-images', id] });
    await qc.invalidateQueries({ queryKey: ['admin-news'] });
  };

  const uploadImages = async (files: File[]) => {
    if (!newsId) return;
    const room = MAX_IMAGES - imageList.length;
    if (room <= 0) {
      toast({
        title: 'Límite alcanzado',
        description: `Cada noticia puede tener como máximo ${MAX_IMAGES} imágenes.`,
        variant: 'destructive',
      });
      return;
    }
    const selected = files.slice(0, room);
    if (files.length > room) {
      toast({
        title: 'Se subirán solo algunas',
        description: `Quedan ${room} espacios libres para esta noticia.`,
      });
    }
    setUploading(true);
    try {
      let maxSort = imageList.reduce((m, i) => Math.max(m, i.sort), 0);
      for (const file of selected) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`"${file.name}": usa JPG, PNG, WebP o AVIF.`);
        }
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error(`"${file.name}": el tamaño máximo es de 5 MB.`);
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${IMAGE_PREFIX}${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        maxSort += 10;
        const { error: insErr } = await db('news_images').insert({
          news_id: newsId,
          storage_path: path,
          image_url: data.publicUrl,
          sort: maxSort,
        });
        if (insErr) {
          // Evitamos dejar archivos huérfanos si la fila no se puede crear.
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }
      }
      await normalizeAndSyncCover(newsId);
      await refreshImages(newsId);
      toast({ title: 'Imágenes subidas' });
    } catch (err) {
      toast({
        title: 'Error al subir la imagen',
        description: (err as Error).message,
        variant: 'destructive',
      });
      if (newsId) await refreshImages(newsId);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (img: NewsImageRow) => {
    if (!newsId) return;
    setBusy(true);
    try {
      const { error: delErr } = await db('news_images').delete().eq('id', img.id);
      if (delErr) throw delErr;

      // Solo borramos el archivo si ninguna otra imagen lo utiliza.
      const { data: shared, error: sharedErr } = await db('news_images')
        .select('id')
        .eq('storage_path', img.storage_path)
        .limit(1);
      if (sharedErr) throw sharedErr;
      const { data: sharedCover, error: coverErr } = await db('news')
        .select('id')
        .eq('image_url', img.image_url)
        .neq('id', newsId)
        .limit(1);
      if (coverErr) throw coverErr;
      if ((shared ?? []).length === 0 && (sharedCover ?? []).length === 0) {
        await supabase.storage.from(BUCKET).remove([img.storage_path]);
      }

      await normalizeAndSyncCover(newsId);
      await refreshImages(newsId);
      toast({ title: 'Imagen eliminada' });
    } catch (err) {
      toast({
        title: 'Error al eliminar la imagen',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    if (!newsId) return;
    const other = index + direction;
    if (other < 0 || other >= imageList.length) return;
    const a = imageList[index];
    const b = imageList[other];
    setBusy(true);
    try {
      const { error: e1 } = await db('news_images').update({ sort: b.sort }).eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await db('news_images').update({ sort: a.sort }).eq('id', b.id);
      if (e2) throw e2;
      await normalizeAndSyncCover(newsId);
      await refreshImages(newsId);
    } catch (err) {
      toast({
        title: 'Error al reordenar',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
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
        url: f.url.trim() || null,
        published: f.published,
      };
      if (f.id) {
        const { error } = await db('news').update(payload).eq('id', f.id);
        if (error) throw error;
        return f.id as string;
      }
      const { data, error } = await db('news').insert(payload).select('id').single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (id, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-news'] });
      if (variables.id) {
        toast({ title: 'Noticia guardada correctamente' });
        setForm(null);
      } else {
        // Necesitamos el id de la noticia para poder subir sus imágenes.
        toast({
          title: 'Noticia creada',
          description: 'Ahora puedes añadir sus imágenes.',
        });
        setForm((prev) => (prev ? { ...prev, id } : prev));
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (n: NewsRow) => {
      const { data: imgs, error: imgErr } = await db('news_images')
        .select('*')
        .eq('news_id', n.id);
      if (imgErr) throw imgErr;
      const rows = (imgs ?? []) as NewsImageRow[];

      const { error } = await db('news').delete().eq('id', n.id);
      if (error) throw error;

      for (const img of rows) {
        const { data: shared } = await db('news_images')
          .select('id')
          .eq('storage_path', img.storage_path)
          .limit(1);
        if ((shared ?? []).length === 0) {
          await supabase.storage.from(BUCKET).remove([img.storage_path]);
        }
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
            Crea y publica las noticias de la sección de socios, en castellano e inglés, con hasta{' '}
            {MAX_IMAGES} imágenes por noticia.
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
                <Label className="text-xs">Imágenes</Label>

                {!form.id ? (
                  <p className="text-xs text-muted-foreground">
                    Guarda primero la noticia y después podrás añadir sus imágenes.
                  </p>
                ) : (
                  <>
                    {imagesLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando imágenes…
                      </div>
                    ) : imageList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin imágenes</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {imageList.map((img, index) => (
                          <div key={img.id} className="space-y-1">
                            <div className="relative">
                              <img
                                src={img.image_url}
                                alt={`Imagen ${index + 1} de la noticia`}
                                loading="lazy"
                                className="h-24 w-full rounded object-cover"
                              />
                              {index === 0 && (
                                <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0">
                                  Portada
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={busy || uploading || index === 0}
                                onClick={() => moveImage(index, -1)}
                                aria-label="Mover imagen a la izquierda"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={busy || uploading || index === imageList.length - 1}
                                onClick={() => moveImage(index, 1)}
                                aria-label="Mover imagen a la derecha"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 ml-auto"
                                disabled={busy || uploading}
                                onClick={() => removeImage(img)}
                                aria-label="Eliminar imagen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        disabled={uploading || busy || imageList.length >= MAX_IMAGES}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          e.target.value = '';
                          if (files.length) uploadImages(files);
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
                      JPG, PNG, WebP o AVIF · máximo 5 MB por archivo · {imageList.length}/
                      {MAX_IMAGES} imágenes · la primera es la portada
                    </p>
                  </>
                )}
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
              disabled={saveMutation.isPending || uploading || busy}
            >
              {form?.id ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button
              size="sm"
              onClick={() => form && saveMutation.mutate(form)}
              disabled={saveMutation.isPending || uploading || busy}
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
              Se eliminará “{deleteTarget?.title?.es || 'sin título'}” y sus imágenes. Esta acción no
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
