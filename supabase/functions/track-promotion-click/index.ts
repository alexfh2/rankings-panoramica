import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Public endpoint used by panoramicaclubdegolf.com.
// GET ?id=<promotion_id>  -> records click and 302-redirects to the CTA destination.
// POST {id}               -> records click and returns JSON (for beacons).
const CLUB_EMAIL = "golf@panoramicagrupo.com";
const CLUB_PHONE = "+34964493072";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let id: string | null = new URL(req.url).searchParams.get("id");
  if (req.method === "POST") {
    try {
      const body = await req.json();
      id = typeof body?.id === "string" ? body.id : id;
    } catch { /* ignore */ }
  }
  if (!id || !UUID.test(id)) return json({ error: "invalid id" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: promo } = await sb.from("promotions").select("id, cta_type, link_url").eq("id", id).maybeSingle();
  if (!promo) return json({ error: "not found" }, 404);

  const cta = promo.cta_type as string;
  const dest =
    cta === "web" ? promo.link_url :
    cta === "email" ? `mailto:${CLUB_EMAIL}` :
    cta === "phone" ? `tel:${CLUB_PHONE}` : null;

  await sb.from("promotion_clicks").insert({ promotion_id: id, cta_type: cta });

  if (req.method === "GET" && dest) {
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: dest, "Cache-Control": "no-store" } });
  }
  return json({ ok: true, destination: dest });
});
