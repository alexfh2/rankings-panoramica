import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require admin role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAuth.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { round_id, language } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*, competitions(id, slug, name, format)")
      .eq("id", round_id)
      .single();
    if (roundError) throw roundError;

    // --- Competition identity (from the round's structured competition_id) ---
    const competition: any = (round as any).competitions || null;
    const competitionSlug: string = competition?.slug || '';
    const EDITORIAL_NAMES: Record<string, string> = {
      'individual-2026': 'Orden de Mérito Individual',
      'parejas-2026': 'Orden de Mérito de Parejas',
      'verano-2026': 'Liga de Verano',
    };
    const competitionName =
      EDITORIAL_NAMES[competitionSlug] || competition?.name || 'competición';
    const isPairs = competition?.format === 'pairs';

    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Build fixed category HCP map (first played round per player, season-wide)
    const { data: seasonRounds } = await supabase
      .from("rounds")
      .select("id, date, round_number, status")
      .eq("season_id", round.season_id);
    const consideredRoundIds = (seasonRounds || [])
      .filter((r: any) => r.status === "published" || r.id === round_id)
      .map((r: any) => r.id);
    const roundMeta = new Map<string, any>((seasonRounds || []).map((r: any) => [r.id, r]));
    const { data: allSeasonResults } = await supabase
      .from("results")
      .select("player_id, handicap_at_round, play_date, created_at, round_id, players(initial_handicap, current_handicap)")
      .in("round_id", consideredRoundIds.length ? consideredRoundIds : [round_id]);
    const sortKey = (r: any) => {
      const meta = roundMeta.get(r.round_id) || {};
      const d = r.play_date || meta.date || "";
      const n = String(meta.round_number ?? 9999).padStart(4, "0");
      const c = r.created_at || "";
      return `${d || "9999-99-99"}|${n}|${c}`;
    };
    const firstByPlayer = new Map<string, any>();
    for (const r of (allSeasonResults || [])) {
      if (r.handicap_at_round == null) continue;
      const prev = firstByPlayer.get(r.player_id);
      if (!prev || sortKey(r) < sortKey(prev)) firstByPlayer.set(r.player_id, r);
    }
    const categoryHcpMap = new Map<string, number | null>();
    for (const [pid, r] of firstByPlayer.entries()) categoryHcpMap.set(pid, r.handicap_at_round);
    for (const r of (allSeasonResults || [])) {
      if (categoryHcpMap.has(r.player_id)) continue;
      const p: any = r.players;
      categoryHcpMap.set(r.player_id, p?.initial_handicap ?? p?.current_handicap ?? null);
    }
    const getCatHcp = (r: any) =>
      categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? r.players?.current_handicap ?? null;
    const getHcp = (r: any) => r.handicap_at_round ?? r.players?.current_handicap ?? null;
    // Stableford tiebreaker: lower HCP wins
    const sortByPointsThenLowHcp = (a: any, b: any) => {
      const diff = (b.stableford_points ?? 0) - (a.stableford_points ?? 0);
      if (diff !== 0) return diff;
      return (Number(getHcp(a)) || Infinity) - (Number(getHcp(b)) || Infinity);
    };
    const hcpLow = results
      .filter((r: any) => { const h = getCatHcp(r); return h != null && Number(h) <= 15.0; })
      .sort(sortByPointsThenLowHcp);
    const hcpHigh = results
      .filter((r: any) => { const h = getCatHcp(r); return h != null && Number(h) > 15.0; })
      .sort(sortByPointsThenLowHcp);
    const females = results
      .filter((r: any) => r.players?.gender === "F")
      .sort(sortByPointsThenLowHcp);
    const seniors = results
      .filter((r: any) => r.players?.is_senior === true)
      .sort(sortByPointsThenLowHcp);

    // --- Pairs data (only for pairs competitions) ---
    let pairsBlock = '';
    let pairsCount = 0;
    if (isPairs) {
      const { data: pairResults } = await supabase
        .from("pair_results")
        .select("net_points, position, pairs(fixed_category, player_1_id, player_2_id)")
        .eq("round_id", round_id)
        .order("net_points", { ascending: false });

      const rows = (pairResults || []) as any[];
      pairsCount = rows.length;

      const playerIds = Array.from(
        new Set(rows.flatMap((r: any) => [r.pairs?.player_1_id, r.pairs?.player_2_id]).filter(Boolean))
      );
      const nameById = new Map<string, string>();
      if (playerIds.length) {
        const { data: playerRows } = await supabase
          .from("players")
          .select("id, name")
          .in("id", playerIds);
        for (const p of (playerRows || []) as any[]) nameById.set(p.id, p.name);
      }

      const label = (c: string) =>
        c === 'hcp_low' ? 'CATEGORÍA HÁNDICAP BAJO' : c === 'hcp_high' ? 'CATEGORÍA HÁNDICAP ALTO' : `CATEGORÍA ${c}`;
      const pairName = (r: any) =>
        `${nameById.get(r.pairs?.player_1_id) || '?'} / ${nameById.get(r.pairs?.player_2_id) || '?'}`;
      const groups = new Map<string, any[]>();
      for (const r of rows) {
        const cat = r.pairs?.fixed_category || 'sin_categoria';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(r);
      }
      const sections: string[] = [];
      for (const [cat, list] of groups.entries()) {
        sections.push(
          `${label(cat)} — ${list.length} parejas:\n` +
            list
              .slice(0, 3)
              .map((r, i) => `${i + 1}. ${pairName(r)} — ${r.net_points} pts`)
              .join('\n')
        );
      }
      pairsBlock = sections.join('\n\n');
    }

    const langLabel = language === "ca" ? "català" : "castellano";
    const publishedUrl = "https://rankingspanoramica.fairwaystudio.ai/ranquings";

    const modalityLine = isPairs
      ? "Modalidad: Fourball Stableford por parejas. Todos los resultados son en PUNTOS Stableford netos de la pareja. Trata a la pareja como una única unidad competitiva, nunca como jugadores individuales."
      : "Modalidad: Stableford individual. Todos los resultados son en PUNTOS Stableford, nunca en golpes ni scratch.";

    const competitionGuidance = isPairs
      ? `Se trata de una jornada de la ${competitionName}: habla de parejas ganadoras y de resultados de parejas.`
      : competitionSlug === "verano-2026"
        ? `Se trata de una jornada de la ${competitionName}: identifícala expresamente como "Liga de Verano" y nunca como Orden de Mérito.`
        : `Se trata de una jornada de la ${competitionName}: habla de jugadores y clasificaciones individuales.`;

    const resultsBlock = isPairs
      ? `${pairsBlock || "Sin resultados de parejas disponibles."}\n\nTotal parejas participantes: ${pairsCount}`
      : `CLASIFICACIÓN HÁNDICAP BAJO (≤15.0) — ${hcpLow.length} jugadores:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASIFICACIÓN HÁNDICAP ALTO (15.1–36.0) — ${hcpHigh.length} jugadores:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}
${females.length > 0 ? `\nCLASIFICACIÓN FEMENINA — Ganadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}
${seniors.length > 0 ? `\nCLASIFICACIÓN SÉNIOR (+65) — Ganador:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ""}

Total participantes: ${results.length}`;

    const prompt = `Redacta un mensaje de WhatsApp para comunicar los resultados de una jornada de golf de Panorámica Golf.
Idioma de redacción: ${langLabel}. Escribe TODO el texto en ese idioma, sin mezclar idiomas.

Competición: ${competitionName}
Jornada: ${round.name}${round.round_number ? ` (J${round.round_number})` : ""}
Temporada: ${season?.year || "N/A"}
Club: ${round.club || "N/A"}
Campo: ${round.course || "N/A"}
Fecha: ${round.date}
${round.sponsor ? `Patrocinador de la jornada: ${round.sponsor}` : ""}
${round.is_master ? "Jornada MASTER (puntos x1.25)" : ""}

Utiliza siempre el nombre correcto de la competición proporcionado.
${modalityLine}
${competitionGuidance}

El texto debe ser breve, deportivo, informativo y natural para la comunicación del club. Puede ser algo más directo que una noticia web, pero nunca publicitario ni grandilocuente.
No inventes ningún dato que no aparezca aquí: ni resultados, ni posiciones, ni meteorología, ni próximos torneos, ni incidencias, ni declaraciones.
NO se te proporcionan datos de la clasificación general: por tanto, no hagas ninguna afirmación sobre la general ni sobre cambios de líder.
Menciona únicamente las categorías que aparezcan en los datos.

RESULTADOS DE LA JORNADA:
${resultsBlock}

INSTRUCCIONES DE FORMATO:
- Título breve con la competición y la jornada, seguido de una frase de contexto con club, fecha y participación.
- Para las categorías principales, incluye los tres primeros clasificados; para Femenina y Sénior, solo el ganador o ganadora.
- Deja una línea en blanco entre secciones para facilitar la lectura.
- Usa *negritas* de WhatsApp para el título y los nombres de categoría.
- Sin emojis (como máximo uno puntual si aporta claridad), sin hashtags y sin texto promocional.
- Cierra con el enlace a las clasificaciones: ${publishedUrl}
- Devuelve SOLO el texto del mensaje, sin JSON ni markdown.`;


    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ets un redactor esportiu de golf. Generes missatges de WhatsApp clars, formals i concisos." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ success: true, message: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
