import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: number[];
  source_url: string;
  source_player_id?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  official_net_points?: number | null;
  official_gross_points?: number | null;
  official_strokes?: number | null;
  pars?: number[] | null;
  hole_hcp?: number[] | null;
  _is_senior?: boolean;
}

const ID_RE = /[a-f0-9]{24}/i;

function extractIds(url: string): { gameId: string | null; categoryId: string | null } {
  const g = url.match(new RegExp(`game/(${ID_RE.source})`, "i"));
  const c = url.match(new RegExp(`category=(${ID_RE.source})`, "i"));
  return {
    gameId: g ? g[1].toLowerCase() : null,
    categoryId: c ? c[1].toLowerCase() : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const format: string | undefined = body?.format;
    const rawUrls: string[] = Array.isArray(body?.urls)
      ? body.urls
      : body?.url
      ? [body.url]
      : [];
    const urls = rawUrls.map((u: string) => String(u || "").trim()).filter(Boolean);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const detectedSource = detectSource(urls[0]);
    let results: ParsedResult[];
    let categories: { id: string; name: string; count: number }[] | undefined;
    let game: { id: string; name?: string; date?: string; course?: string } | undefined;
    let usedCategories: { id: string; name: string; url: string }[] | undefined;

    if (detectedSource === "golfdirecto") {
      const gd = await parseGolfDirecto(urls, format);
      results = gd.results;
      categories = gd.categories;
      game = gd.game;
      usedCategories = gd.usedCategories;
    } else if (detectedSource === "teeone") {
      results = [];
      for (const u of urls) {
        results = results.concat(await parseTeeoneViaAPI(u, format));
      }
    } else {
      results = [];
      for (const u of urls) {
        const response = await fetch(u);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const html = await response.text();
        results = results.concat(parseGenericTable(html, u));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: detectedSource,
        results,
        count: results.length,
        categories,
        game,
        usedCategories,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        code: message.includes("torneos diferentes") ? "GOLFDIRECTO_DIFFERENT_GAME" : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


function detectSource(url: string): string {
  if (url.includes("golfdirecto.com")) return "golfdirecto";
  if (url.includes("teeone.golf") || url.includes("teeone.es")) return "teeone";
  return "generic";
}

// ─── GOLFDIRECTO ───────────────────────────────────────────────────────────────

interface GolfDirectoResult {
  results: ParsedResult[];
  categories: { id: string; name: string; count: number }[];
  game: { id: string; name?: string; date?: string; course?: string };
  usedCategories: { id: string; name: string; url: string }[];
}

/**
 * Llegeix una o diverses URLs de categories del MATEIX torneig de GolfDirecto.
 * Els metadades del torneig es llegeixen una sola vegada.
 * No es requereix cap categoria SCRATCH.
 */
async function parseGolfDirecto(urls: string[], format?: string): Promise<GolfDirectoResult> {
  const parts = urls.map((u) => ({ url: u, ...extractIds(u) }));
  const gameIds = Array.from(new Set(parts.map((p) => p.gameId).filter(Boolean))) as string[];

  if (gameIds.length === 0) {
    throw new Error("No s'ha pogut extreure l'ID del torneig de la URL de GolfDirecto");
  }
  if (gameIds.length > 1) {
    throw new Error("Los enlaces pertenecen a torneos diferentes de GolfDirecto.");
  }
  const gameId = gameIds[0];

  // ── Metadades del torneig: una sola petició per gameId ──
  const gameRes = await fetch(
    `https://www.golfdirecto.com/web/home/game/${gameId}/active`,
    { headers: { Accept: "application/json" } }
  );
  if (!gameRes.ok) throw new Error(`Error obtenint info del torneig GolfDirecto: ${gameRes.status}`);
  const gameData = await gameRes.json();
  const game = gameData.data || gameData;

  const gameMeta = {
    id: gameId,
    name: game.name || undefined,
    date: game.scheduleStartDate || game.finishedDate || undefined,
    course: game.course?.name || game.club?.name || undefined,
  };

  const allCategories: { id: string; name: string; count: number }[] = (game.categories || []).map(
    (c: { _id: string; name: string; __playersCount: number }) => ({
      id: String(c._id).toLowerCase(),
      name: c.name || "Sense nom",
      count: c.__playersCount || 0,
    })
  );

  const scratchCat = allCategories.find((c) => c.name.toUpperCase().includes("SCRATCH"));

  // Resolució de categories a llegir:
  //  - una sola URL: es manté el comportament anterior (SCRATCH si existeix).
  //  - diverses URLs: es respecta la categoria explícita de cada enllaç.
  const targetIds: { id: string; url: string }[] = [];
  if (parts.length === 1) {
    const id = scratchCat?.id || parts[0].categoryId || allCategories[0]?.id;
    if (id) targetIds.push({ id, url: parts[0].url });
  } else {
    for (const p of parts) {
      const id = p.categoryId || scratchCat?.id || allCategories[0]?.id;
      if (id && !targetIds.some((t) => t.id === id)) targetIds.push({ id, url: p.url });
    }
  }

  if (targetIds.length === 0) {
    throw new Error("No s'han trobat categories al torneig de GolfDirecto");
  }

  const usedCategories = targetIds.map((t) => ({
    id: t.id,
    name: allCategories.find((c) => c.id === t.id)?.name || t.id,
    url: t.url,
  }));
  console.log(
    `[parse-results] GolfDirecto game=${gameId} → categories: ${usedCategories
      .map((c) => `${c.name}(${c.id})`)
      .join(", ")} of ${allCategories.length} available`
  );

  // Senior cross-reference (si el torneig publica una categoria SENIOR)
  const seniorCatId = allCategories.find((c) => c.name.toUpperCase().includes("SENIOR"))?.id;
  const seniorLicenses = new Set<string>();
  if (seniorCatId) {
    try {
      const seniorRes = await fetch(
        `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${seniorCatId}`,
        { headers: { Accept: "application/json" } }
      );
      if (seniorRes.ok) {
        const seniorData = await seniorRes.json();
        for (const entry of (seniorData.data || [])) {
          const lic = entry.player?.license;
          if (lic) seniorLicenses.add(lic);
        }
      }
    } catch { /* ignore */ }
  }

  interface EntryData {
    playerId: string;
    result: ParsedResult;
  }
  const entryDataList: EntryData[] = [];

  for (const target of targetIds) {
    const rankRes = await fetch(
      `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${target.id}`,
      { headers: { Accept: "application/json" } }
    );
    if (!rankRes.ok) throw new Error(`Error obtenint ranking GolfDirecto: ${rankRes.status}`);
    const rankData = await rankRes.json();
    const entries = rankData.data || [];

    const selectedCat = allCategories.find((c) => c.id === target.id);
    const isScratchCat = !!selectedCat?.name?.toUpperCase().includes("SCRATCH");

    for (const entry of entries) {
      const player = entry.player || {};
      const view = entry.view || {};
      const dayView = view.day || view.acc || {};

      // Format: "APELLIDOS, NOMBRE" (federation standard) for consistent alphabetical sorting
      const surname = (player.surname || "").trim();
      const firstName = (player.firstName || "").trim();
      const name = surname && firstName ? `${surname}, ${firstName}` : (surname || firstName);
      if (!name || name.length < 2) continue;

      const positionValue = parseNumber(dayView.rankingPosition ?? dayView.realRanking);
      const hcpExact = parseNumber(player.hcpExact);
      const hcpGame = parseNumber(player.hcpGame);
      const officialNet = parseNumber(dayView.onlyNet ?? (!isScratchCat ? dayView.result : null));
      const officialGross = parseNumber(dayView.onlyGross ?? (isScratchCat ? dayView.result : null));
      const officialStrokes = parseNumber(dayView.strokeNumber);
      const scratchScore = officialStrokes ?? officialGross;

      const license = player.license || "";

      entryDataList.push({
        playerId: player._id || "",
        result: {
          position: positionValue != null ? Math.trunc(positionValue) : 0,
          name,
          license,
          gender: player.gender === "F" ? "F" : player.gender === "M" ? "M" : "",
          handicap: hcpExact,
          handicap_play: hcpGame != null ? Math.trunc(hcpGame) : null,
          stableford_points: officialNet,
          scratch_score: scratchScore,
          scores: [],
          source_url: target.url,
          source_player_id: player._id || null,
          category_id: target.id,
          category_name: selectedCat?.name || null,
          official_net_points: officialNet,
          official_gross_points: officialGross,
          official_strokes: officialStrokes,
          pars: null,
          hole_hcp: null,
          _is_senior: seniorLicenses.has(license),
        },
      });
    }
  }

  // Fetch hole-by-hole scorecards in parallel (batches of 10)
  const batchSize = 10;
  for (let i = 0; i < entryDataList.length; i += batchSize) {
    const batch = entryDataList.slice(i, i + batchSize);
    const scorecardPromises = batch.map(async (ed) => {
      if (!ed.playerId) return;
      try {
        const cardRes = await fetch(
          `https://www.golfdirecto.com/web/home/score/player/${ed.playerId}/result?game=${gameId}`,
          { headers: { Accept: "application/json" } }
        );
        if (!cardRes.ok) return;
        const cardData = await cardRes.json();
        const data = cardData.data || cardData;
        const score = data.score || {};
        const tee = data.gameTee || {};

        const holes: number[] = [];
        for (let h = 1; h <= 18; h++) {
          const val = score[`gross${h}`];
          if (val != null) holes.push(Number(val));
          else holes.push(0);
        }

        const pars: number[] = [];
        const holeHcp: number[] = [];
        for (let h = 1; h <= 18; h++) {
          const p = parseNumber(tee[`par${h}`]);
          const hc = parseNumber(tee[`hcp${h}`]);
          if (p != null) pars.push(p);
          if (hc != null) holeHcp.push(hc);
        }
        if (pars.length === 18) ed.result.pars = pars;
        if (holeHcp.length === 18) ed.result.hole_hcp = holeHcp;

        const hasData = holes.some((v) => v > 0);
        if (hasData) {
          ed.result.scores = holes;
          // If any hole is 0 (ball picked up), the strokes total is not comparable
          if (holes.some((v) => v === 0)) {
            ed.result.scratch_score = ed.result.official_gross_points ?? null;
          }
        }
      } catch {
        // silently skip scorecard errors
      }
    });
    await Promise.all(scorecardPromises);
  }

  const results = entryDataList.map((ed) => ed.result);
  results.sort((a, b) => a.position - b.position);

  return { results, categories: allCategories, game: gameMeta, usedCategories };
}


// ─── TEEONE ────────────────────────────────────────────────────────────────────

async function parseTeeoneViaAPI(url: string, format?: string): Promise<ParsedResult[]> {
  const pageResponse = await fetch(url);
  if (!pageResponse.ok) throw new Error(`Failed to fetch Teeone page: ${pageResponse.status}`);
  const html = await pageResponse.text();

  const getHidden = (name: string): string => {
    const match = html.match(new RegExp(`${name}"\\s*value="([^"]*)"`));
    return match ? match[1] : "";
  };

  const apiDomain = getHidden("HidAPIDominio");
  const token = getHidden("HidTokenAPI");
  const idInicioSesion = getHidden("HidInicioSesion");
  const idVendedor = getHidden("HidVendedor");
  const codTorneo = getHidden("HidTorneo");
  const culture = getHidden("HidCultura") || "es-ES";

  if (!apiDomain || !token || !codTorneo) {
    throw new Error("No s'han pogut extreure els paràmetres de l'API de Teeone. Comprova la URL.");
  }

  const vueltasRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerVueltasLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ culture, token, idInicioSesion, idVendedor, codTorneo }),
  });
  const vueltasData = await vueltasRes.json();
  const vueltas: number[] = vueltasData.cod === 1 ? vueltasData.listaVueltas : [1];
  const lastVuelta = vueltas[vueltas.length - 1] || 1;

  const isStableford = !format || format === "stableford";
  const idTipoClasificacion = isStableford ? "4" : "1";

  const classRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerPosicionesClasificacionLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      culture, token, idInicioSesion, idVendedor, codTorneo,
      numVuelta: String(lastVuelta),
      idTipoClasificacion,
      codSexo: "T", hcpDesde: "-10", hcpHasta: "54",
      hcpDesempate: false, codNivel: "T",
    }),
  });

  const classData = await classRes.json();
  if (classData.cod !== 1 || !classData.listaPosiciones) {
    throw new Error(classData.msg || "Error obtenint classificació de Teeone");
  }

  const results: ParsedResult[] = [];
  for (const p of classData.listaPosiciones) {
    const pos = parseInt(p.pos) || p.posReal || 0;
    if (!p.nombre || p.nombre.trim().length < 2) continue;

    const scores: number[] = [];
    if (p.r1 && parseInt(p.r1) > 0) scores.push(parseInt(p.r1));
    if (p.r2 && parseInt(p.r2) > 0) scores.push(parseInt(p.r2));
    if (p.r3 && parseInt(p.r3) > 0) scores.push(parseInt(p.r3));
    if (p.r4 && parseInt(p.r4) > 0) scores.push(parseInt(p.r4));

    const total = parseInt(p.tot) || null;
    const handicap = p.hex ? parseFloat(String(p.hex).replace(",", ".")) : null;

    results.push({
      position: pos,
      name: p.nombre.trim(),
      license: p.licencia || "",
      gender: p.codSexo === "F" ? "F" : p.codSexo === "M" ? "M" : "",
      handicap: isNaN(handicap as number) ? null : handicap,
      handicap_play: null,
      stableford_points: isStableford ? total : null,
      scratch_score: !isStableford ? total : null,
      scores,
      source_url: url,
    });
  }

  return results;
}

// ─── GENERIC TABLE ─────────────────────────────────────────────────────────────

function parseGenericTable(html: string, sourceUrl: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let bestTable = "";
  let bestScore = 0;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(clean)) !== null) {
    const content = tableMatch[1].toLowerCase();
    let score = 0;
    if (content.includes("jugador") || content.includes("player") || content.includes("nombre")) score += 5;
    if (content.includes("stableford") || content.includes("puntos")) score += 3;
    if (content.includes("handicap") || content.includes("hcp")) score += 3;
    if (content.includes("pos")) score += 2;
    const rowCount = (content.match(/<tr/g) || []).length;
    score += Math.min(rowCount, 10);
    if (score > bestScore) { bestScore = score; bestTable = tableMatch[1]; }
  }

  if (!bestTable) return results;

  const headerMatch = bestTable.match(/<thead>([\s\S]*?)<\/thead>/i) ||
    bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerMatch) return results;

  const headers: string[] = [];
  const thRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let th;
  while ((th = thRegex.exec(headerMatch[1])) !== null) {
    headers.push(stripHtml(th[1]).trim().toLowerCase());
  }

  const nameIdx = headers.findIndex(h =>
    h.includes("jugador") || h.includes("nombre") || h.includes("player") || h.includes("nom")
  );
  const ptsIdx = headers.findIndex(h =>
    h.includes("stableford") || h.includes("puntos") || h.includes("pts") || h.includes("points")
  );
  const hcpIdx = headers.findIndex(h =>
    h.includes("hcp") || h.includes("handicap") || h.includes("hex")
  );

  if (nameIdx < 0) return results;

  const allRows = bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  let posCounter = 0;

  for (let i = 1; i < allRows.length; i++) {
    const cells: string[] = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cell;
    while ((cell = cellRegex.exec(allRows[i])) !== null) {
      cells.push(cell[1]);
    }
    if (cells.length < 2) continue;

    const name = stripHtml(cells[nameIdx]).trim();
    if (!name || name.length < 2) continue;

    posCounter++;
    const ptsText = ptsIdx >= 0 && ptsIdx < cells.length ? stripHtml(cells[ptsIdx]).trim() : "";
    const hcpText = hcpIdx >= 0 && hcpIdx < cells.length ? stripHtml(cells[hcpIdx]).trim() : "";

    results.push({
      position: posCounter,
      name,
      license: "",
      gender: "",
      handicap: hcpText ? parseFloat(hcpText.replace(",", ".")) : null,
      handicap_play: null,
      stableford_points: ptsText ? parseInt(ptsText) : null,
      scratch_score: null,
      scores: [],
      source_url: sourceUrl,
    });
  }

  return results;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
