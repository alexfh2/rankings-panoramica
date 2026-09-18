import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autoritzat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autoritzat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: hasRole } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Només admins poden crear admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const { email, password } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email invàlid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(JSON.stringify({ error: "La contrasenya ha de tenir mínim 6 caràcters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user server-side (does NOT affect caller's session)
    let userId: string | null = null;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const alreadyExists = /already.*registered|already exists/i.test(createError.message ?? "");
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the existing user and reuse it (idempotent: just grant the role)
      const target = email.trim().toLowerCase();
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: list, error: listError } = await adminClient.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listError) {
          return new Response(JSON.stringify({ error: listError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const found = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
        if (found) userId = found.id;
        if (list.users.length < 200) break;
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Aquest correu ja està registrat però no s'ha pogut localitzar l'usuari" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      userId = newUser.user.id;
    }

    // Assign admin role (idempotent thanks to the unique (user_id, role) constraint)
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
