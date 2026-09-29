export const PROMO_BUCKET = 'photos';
export const PROMO_FOLDER = 'promotions';
export const PROMO_MAX_BYTES = 2 * 1024 * 1024;
export const PROMO_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export const PROMO_IMAGE_FIELDS = [
  'image_desktop_url',
  'image_mobile_url',
  'image_desktop_url_en',
  'image_mobile_url_en',
  'image_desktop_url_fr',
  'image_mobile_url_fr',
] as const;
export type PromoImageField = (typeof PROMO_IMAGE_FIELDS)[number];

export type PromoStatus = 'vigente' | 'programada' | 'caducada';

export const madridToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const promoStatus = (
  p: { start_date: string; end_date: string | null; images_purged_at: string | null },
  today = madridToday(),
): PromoStatus => {
  if (p.images_purged_at) return 'caducada';
  if (p.start_date > today) return 'programada';
  if (p.end_date && p.end_date < today) return 'caducada';
  return 'vigente';
};

export const storagePathFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PROMO_BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split('?')[0]) : null;
};

export const isValidUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
