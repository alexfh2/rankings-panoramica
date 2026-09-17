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

    const { round_id, language, tone, sponsor, special_mention, weather_conditions } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch round data
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


    // Fetch results for THIS round with player info
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    // Fetch season
    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Fetch ALL season rounds to compute fixed category HCP (first round played per player)
    const { data: seasonRounds } = await supabase
      .from("rounds")
      .select("id, date, round_number, status")
      .eq("season_id", round.season_id);
    const consideredRoundIds = (seasonRounds || [])
      .filter((r: any) => r.status === 'published' || r.id === round_id)
      .map((r: any) => r.id);
    const roundMeta = new Map<string, any>((seasonRounds || []).map((r: any) => [r.id, r]));

    const { data: allSeasonResults } = await supabase
      .from("results")
      .select("player_id, handicap_at_round, play_date, created_at, round_id, players(initial_handicap, current_handicap)")
      .in("round_id", consideredRoundIds.length ? consideredRoundIds : [round_id]);

    const sortKey = (r: any) => {
      const meta = roundMeta.get(r.round_id) || {};
      const d = r.play_date || meta.date || '';
      const n = String(meta.round_number ?? 9999).padStart(4, '0');
      const c = r.created_at || '';
      return `${d || '9999-99-99'}|${n}|${c}`;
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

    // Categorize by FIXED category HCP — matches public Rounds page
    const hcpLow = results
      .filter((r: any) => { const h = getCatHcp(r); return h != null && Number(h) <= 15.0; })
      .sort(sortByPointsThenLowHcp);
    const hcpHigh = results
      .filter((r: any) => { const h = getCatHcp(r); return h != null && Number(h) > 15.0; })
      .sort(sortByPointsThenLowHcp);
    const females = results
      .filter((r: any) => r.players?.gender === 'F')
      .sort(sortByPointsThenLowHcp);
    const seniors = results
      .filter((r: any) => r.players?.is_senior === true)
      .sort(sortByPointsThenLowHcp);

    // Notable scorecards (birdies)
    const coursePar = round.course_par as number[] | null;
    let notablePerformances = '';
    if (coursePar && Array.isArray(coursePar)) {
      results.forEach((r: any) => {
        if (r.scorecard && Array.isArray(r.scorecard)) {
          const birdies = r.scorecard.filter((s: any, i: number) => typeof s === 'number' && s > 0 && s < coursePar[i]).length;
          if (birdies >= 3) {
            notablePerformances += `${r.players?.name}: ${birdies} birdies. `;
          }
        }
      });
    }

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

    const langLabel = language === 'ca' ? 'català' : 'castellano';

    const resultsBlock = isPairs
      ? `${pairsBlock || 'Sin resultados de parejas disponibles.'}

Total parejas participantes: ${pairsCount}`
      : `CLASIFICACIÓN HÁNDICAP BAJO (≤15.0) — ${hcpLow.length} jugadores:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

CLASIFICACIÓN HÁNDICAP ALTO (15.1–36.0) — ${hcpHigh.length} jugadores:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

${females.length > 0 ? `CLASIFICACIÓN FEMENINA — ${females.length} jugadoras:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ''}
${seniors.length > 0 ? `CLASIFICACIÓN SÉNIOR (+65) — ${seniors.length} jugadores:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ''}
${notablePerformances ? `ACTUACIONES DESTACADAS (birdies): ${notablePerformances}` : ''}

Total participantes: ${results.length}`;

    const modalityLine = isPairs
      ? 'Modalidad: Fourball Stableford por parejas. Todos los resultados son puntos Stableford de la pareja. No menciones resultados scratch ni golpes totales.'
      : 'Modalidad: Stableford individual. Todos los resultados son puntos Stableford. No menciones resultados scratch ni golpes totales.';

    const competitionGuidance = isPairs
      ? `Se trata de una jornada de la ${competitionName}. Redacta la crónica tratando a la pareja como unidad competitiva: los protagonistas son las parejas, no los jugadores por separado. No la redactes como una competición individual.`
      : competitionSlug === 'verano-2026'
        ? `Se trata de una jornada de la ${competitionName}. Identifica expresamente la competición como "${competitionName}". No la llames Orden de Mérito ni ningún otro nombre.`
        : `Se trata de una jornada de la ${competitionName}. Habla de jugadores y clasificaciones individuales.`;

    const prompt = `Actúa como redactor de prensa deportiva especializado en golf.
Redacta una crónica breve y rigurosa para la web de Panorámica Golf a partir exclusivamente de los datos proporcionados.
Idioma de redacción: ${langLabel}. Escribe TODO el texto en ese idioma, sin mezclar idiomas.

Competición: ${competitionName}
Jornada: ${round.name}${round.round_number ? ` (J${round.round_number})` : ''}
Fecha: ${round.date}

Utiliza siempre el nombre correcto de la competición proporcionado.
${modalityLine}
${competitionGuidance}

El tono debe ser serio, deportivo, periodístico y elegante. Prioriza los hechos, resultados, ganadores y contexto competitivo.
No utilices tono promocional ni grandilocuente, ni clichés vacíos, ni exceso de adjetivos.
No inventes ningún dato que no aparezca en la información proporcionada.
No inventes meteorología, ambiente, declaraciones, récords, remontadas, cambios de líder, participación, incidencias, próximos torneos ni consecuencias para la clasificación general.
NO se te proporcionan datos de la clasificación general: por tanto, no hagas ninguna afirmación sobre la general ni sobre su evolución.
Menciona únicamente las categorías que aparezcan en los datos.

DATOS DE LA JORNADA:
- Jornada: ${round.name}${round.round_number ? ` (J${round.round_number})` : ''}
- Temporada: ${season?.year || 'N/A'}
- Club: ${round.club || 'N/A'}
- Campo: ${round.course || 'N/A'}
- Fecha: ${round.date}
${sponsor ? `- Patrocinador: ${sponsor}` : ''}
${round.is_master ? '- Jornada MASTER (puntos x1.25)' : ''}
${special_mention ? `- Mención especial: ${special_mention}` : ''}
${(() => {
  const w = weather_conditions || {};
  const lines: string[] = [];
  if (w.friday) lines.push(`  · Viernes: ${w.friday}`);
  if (w.saturday) lines.push(`  · Sábado: ${w.saturday}`);
  if (w.sunday) lines.push(`  · Domingo: ${w.sunday}`);
  if (w.green_speed) lines.push(`  · Velocidad de los greens: ${w.green_speed}`);
  if (w.wind) lines.push(`  · Viento: ${w.wind}`);
  return lines.length ? `- Condiciones facilitadas por la organización (solo estas; no añadas otras):\n${lines.join('\n')}` : '';
})()}

RESULTADOS DE LA JORNADA:
${resultsBlock}

ESTRUCTURA SOLICITADA:
- TITULAR informativo y específico, basado en el resultado. Evita titulares genéricos.
- ENTRADILLA: un párrafo corto que identifique jornada y competición y resuma el principal resultado deportivo.
- CUERPO: de 2 a 4 párrafos breves, destacando los resultados relevantes y separando categorías con naturalidad cuando proceda. Separa los párrafos con una línea en blanco.
- CIERRE breve, que puede situar la jornada dentro de la competición, sin anunciar la siguiente cita si no se proporciona.

No incluyas emojis, hashtags ni texto promocional.

Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
{
  "title": "titular",
  "subtitle": "entradilla en una frase",
  "body": "cuerpo de la noticia con el cierre incluido",
  "highlights": ["dato destacado", "dato destacado"],
  "seo_excerpt": "resumen de máximo 160 caracteres"
}`;


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
          { role: "system", content: "Eres un redactor de prensa deportiva especializado en golf. Responde SIEMPRE con JSON válido, sin markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown wrapping)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const news = JSON.parse(cleaned);

    return new Response(JSON.stringify({ success: true, news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
