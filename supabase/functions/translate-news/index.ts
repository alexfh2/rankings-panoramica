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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require admin role (same pattern as generate-news) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAuth.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const payload = await req.json().catch(() => null);
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";

    if (!title && !body) {
      return json({ error: "No hay contenido en castellano que traducir." }, 400);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return json({ error: "Falta la configuración de IA (LOVABLE_API_KEY)." }, 500);
    }

    const prompt = `Actúa como traductor profesional especializado en golf y prensa deportiva.
Traduce del español al inglés el contenido proporcionado.
La traducción debe ser fiel al original, natural en inglés y adecuada para la web de un club de golf.

Mantén:
- nombres propios;
- nombres de jugadores;
- resultados;
- puntuaciones;
- fechas;
- cifras;
- nombres oficiales de competiciones;
- estructura y significado del texto (incluidos los saltos de línea y los párrafos).

Utiliza terminología natural de golf en inglés cuando corresponda.
No añadas información.
No elimines información.
No resumas.
No amplíes.
No cambies resultados ni cifras.
No inventes contexto.
No conviertas la traducción en un nuevo artículo.

Nombres oficiales de competiciones (utiliza siempre estas equivalencias):
- Orden de Mérito Individual → Individual Order of Merit
- Orden de Mérito de Parejas → Pairs Order of Merit
- Liga de Verano → Summer League
- Panorámica Golf → Panorámica Golf
No traduzcas nombres propios de jugadores.

CONTENIDO A TRADUCIR
Título (ES): ${title || "(vacío)"}
Texto (ES):
${body || "(vacío)"}

Devuelve exclusivamente los campos traducidos solicitados en JSON válido, con esta forma exacta:
{"title": "título en inglés", "body": "texto en inglés"}
Si un campo llega vacío, devuélvelo como cadena vacía.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres un traductor profesional de español a inglés especializado en golf y prensa deportiva. Traduces con fidelidad literal, sin añadir ni eliminar información. Responde SIEMPRE con JSON válido, sin markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      if (aiResponse.status === 429) {
        return json({ error: "El servicio de IA está saturado. Inténtalo de nuevo en unos minutos." }, 429);
      }
      if (aiResponse.status === 402) {
        return json({ error: "No quedan créditos de IA disponibles para traducir." }, 402);
      }
      return json({ error: `Error del servicio de IA: ${detail.slice(0, 300)}` }, 502);
    }

    const aiData = await aiResponse.json();
    const raw: string = aiData?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: { title?: unknown; body?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return json({ error: "La traducción recibida no tiene un formato válido." }, 502);
      }
      parsed = JSON.parse(match[0]);
    }

    return json({
      title: typeof parsed.title === "string" ? parsed.title : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
