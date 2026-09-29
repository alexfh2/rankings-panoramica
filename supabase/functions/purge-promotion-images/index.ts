import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "photos";
const IMAGE_FIELDS = [
  "image_desktop_url",
  "image_mobile_url",
  "image_desktop_url_en",
  "image_mobile_url_en",
  "image_desktop_url_fr",
  "image_mobile_url_fr",
] as const;

const madridParts = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

const pathFromUrl = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const payload = await req.json().catch(() => ({}));
    const isCron = payload?.source === "cron";
    const { date: today, hour } = madridParts();

    if (isCron) {
      // Cron fires at 02:00 and 03:00 UTC; only the run that is 04:00 in Madrid proceeds (DST-safe).
      if (hour !== 4) return json({ skipped: true, reason: "not 04:00 Europe/Madrid", hour });
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !claims?.claims) return json({ error: "Unauthorized" }, 401);
      const { data: isAdmin } = await authClient.rpc("has_role", {
        _user_id: claims.claims.sub,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
    }

    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 15);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rows, error: selErr } = await admin
      .from("promotions")
      .select(`id, ${IMAGE_FIELDS.join(", ")}`)
      .not("end_date", "is", null)
      .lt("end_date", cutoffDate)
      .is("images_purged_at", null);
    if (selErr) throw selErr;

    let cleaned = 0;
    for (const row of (rows ?? []) as Record<string, string | null>[]) {
      const paths = IMAGE_FIELDS.map((f) => row[f])
        .filter((u): u is string => !!u)
        .map(pathFromUrl)
        .filter((p): p is string => !!p);
      if (paths.length) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        if (rmErr) console.error(`Storage remove failed for ${row.id}:`, rmErr.message);
      }
      const update: Record<string, unknown> = {
        active: false,
        images_purged_at: new Date().toISOString(),
      };
      IMAGE_FIELDS.forEach((f) => (update[f] = null));
      const { error: upErr } = await admin.from("promotions").update(update).eq("id", row.id);
      if (upErr) {
        console.error(`Update failed for ${row.id}:`, upErr.message);
        continue;
      }
      cleaned++;
    }

    console.log(`purge-promotion-images: ${cleaned} promociones limpiadas (corte ${cutoffDate}, origen ${isCron ? "cron" : "manual"})`);
    return json({ cleaned, cutoff: cutoffDate });
  } catch (e) {
    console.error("purge-promotion-images error:", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
