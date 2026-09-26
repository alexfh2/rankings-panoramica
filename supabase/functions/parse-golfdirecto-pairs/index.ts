/**
 * Lector GolfDirecto EXCLUSIU per a competicions de Parelles (Fourball).
 * Independent del lector Individual (parse-results). No escriu a la base de dades.
 * Retorna les dades en brut (sense convertir 0 → null): l'adaptador del
 * frontend (golfDirectoPairsToParsedPairs) fa la normalització.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://www.golfdirecto.com/api/v2/public";
const ID = "[a-f0-9]{24}";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (code: string, error: string, status = 400) => json({ success: false, code, error }, status);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error(`GolfDirecto ${res.status}`), { status: res.status });
  const body = await res.json();
  return body?.data ?? body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Autenticació: només administradors ──
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return fail("UNAUTHORIZED", "No autorizado", 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(auth.slice(7));
    if (userError || !userData?.user) return fail("UNAUTHORIZED", "No autorizado", 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return fail("NOT_ADMIN", "Solo los administradores pueden importar resultados", 403);

    // ── Validació d'entrada ──
    const body = await req.json().catch(() => null);
    const rawUrls: unknown = body?.urls;
    if (!Array.isArray(rawUrls) || rawUrls.length === 0 || rawUrls.length > 10) {
      return fail("INVALID_INPUT", "Hay que enviar entre 1 y 10 enlaces de GolfDirecto");
    }
    const parts: { url: string; gameId: string; categoryId: string }[] = [];
    for (const raw of rawUrls) {
      const url = typeof raw === "string" ? raw.trim() : "";
      if (!url || url.length > 500 || !/^https?:\/\/(www\.)?golfdirecto\.com\//i.test(url)) {
        return fail("GOLFDIRECTO_INVALID_URL", `Enlace de GolfDirecto no válido: ${url || "(vacío)"}`);
      }
      const g = url.match(new RegExp(`game/(${ID})`, "i"));
      const c = url.match(new RegExp(`category=(${ID})`, "i"));
      if (!g) return fail("GOLFDIRECTO_MISSING_GAME_ID", `El enlace no contiene el identificador del torneo: ${url}`);
      if (!c) return fail("GOLFDIRECTO_MISSING_CATEGORY_ID", `El enlace no indica la categoría: ${url}`);
      parts.push({ url, gameId: g[1].toLowerCase(), categoryId: c[1].toLowerCase() });
    }
    const gameIds = Array.from(new Set(parts.map((p) => p.gameId)));
    if (gameIds.length > 1) {
      return fail("GOLFDIRECTO_DIFFERENT_GAME", "Los enlaces pertenecen a torneos diferentes de GolfDirecto.");
    }
    const gameId = gameIds[0];
    const categoryIds = Array.from(new Set(parts.map((p) => p.categoryId)));

    // ── Torneig ──
    let game: any;
    try {
      game = await getJson(`${API}/game/${gameId}/active`);
    } catch {
      return fail("GOLFDIRECTO_GAME_NOT_FOUND", "No se ha encontrado el torneo en GolfDirecto.", 404);
    }
    const allCategories: { id: string; name: string }[] = (game?.categories ?? []).map((c: any) => ({
      id: String(c?._id ?? "").toLowerCase(),
      name: str(c?.name) ?? "Sin nombre",
    }));
    for (const id of categoryIds) {
      if (!allCategories.some((c) => c.id === id)) {
        return fail("GOLFDIRECTO_CATEGORY_NOT_FOUND", `La categoría ${id} no existe en este torneo.`);
      }
    }

    // ── Classificacions ──
    type RawPlayer = {
      sourcePlayerId: string | null;
      firstName: string | null;
      surname: string | null;
      license: string | null;
      gender: string | null;
      hcpExact: number | null;
      hcpGame: number | null;
      gross: (number | null)[] | null;
    };
    type RawEntry = {
      sourceCategoryId: string;
      sourceCategoryName: string;
      sourceGroupId: string | null;
      position: number | null;
      netPoints: number | null;
      grossPoints: number | null;
      players: RawPlayer[];
    };
    const entries: RawEntry[] = [];

    for (const categoryId of categoryIds) {
      const list = await getJson(`${API}/score/ranking/entry?game=${gameId}&category=${categoryId}`);
      const catName = allCategories.find((c) => c.id === categoryId)?.name ?? categoryId;
      for (const entry of Array.isArray(list) ? list : []) {
        const mode = entry?.group?.gameConfig?.gameMode;
        if (mode !== "fourBall") {
          return fail(
            "GOLFDIRECTO_NOT_FOURBALL",
            `La categoría ${catName} no es de modalidad Fourball (modalidad: ${mode ?? "desconocida"}).`,
          );
        }
        const day = entry?.view?.day ?? {};
        const players: RawPlayer[] = (entry?.group?.players ?? []).map((p: any) => ({
          sourcePlayerId: str(p?._id),
          firstName: str(p?.firstName),
          surname: str(p?.surname),
          license: str(p?.license),
          gender: str(p?.gender),
          hcpExact: num(p?.hcpExact),
          hcpGame: num(p?.hcpGame),
          gross: null,
        }));
        entries.push({
          sourceCategoryId: categoryId,
          sourceCategoryName: catName,
          sourceGroupId: str(entry?.group?._id),
          position: num(day.rankingPosition),
          netPoints: num(day.onlyNet),
          grossPoints: num(day.onlyGross),
          players,
        });
      }
    }

    // ── Targetes individuals (lots de 8) ──
    const allPlayers = entries.flatMap((e) => e.players).filter((p) => p.sourcePlayerId);
    for (let i = 0; i < allPlayers.length; i += 8) {
      await Promise.all(
        allPlayers.slice(i, i + 8).map(async (p) => {
          try {
            const card = await getJson(`${API}/score/player/${p.sourcePlayerId}/result?game=${gameId}`);
            const score = card?.score;
            if (!score) return;
            const gross: (number | null)[] = [];
            for (let h = 1; h <= 18; h++) gross.push(num(score[`gross${h}`]));
            p.gross = gross;
          } catch {
            p.gross = null;
          }
        }),
      );
    }

    return json({
      success: true,
      game: {
        id: gameId,
        name: str(game?.name),
        date: str(game?.scheduleStartDate),
      },
      categories: categoryIds.map((id) => ({ id, name: allCategories.find((c) => c.id === id)!.name })),
      entries,
    });
  } catch (error) {
    console.error("[parse-golfdirecto-pairs]", error);
    return fail(
      "GOLFDIRECTO_FETCH_FAILED",
      "No se han podido leer los resultados de GolfDirecto. Inténtalo de nuevo.",
      502,
    );
  }
});
