import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado: se requiere rol de administrador.");
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

export const createAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().email().max(255), fullName: z.string().max(255).optional().default("") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const password = generatePassword();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password, email_confirm: true, user_metadata: { full_name: data.fullName } });
    if (error) throw new Error(error.message);
    return { email: data.email, password, userId: created.user?.id ?? "" };
  });

export const listAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // Fuente de verdad: los usuarios de autenticación (aparecen aunque no tengan perfil)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) throw new Error(authError.message);
    const users = authData?.users ?? [];

    // Perfiles (créditos, CVs) y roles
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email, full_name, credits, cvs_generated");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) { const arr = roleMap.get(r.user_id) ?? []; arr.push(r.role); roleMap.set(r.user_id, arr); }

    // Crear perfil faltante para usuarios que no lo tengan (auto-reparación)
    for (const u of users) {
      if (!profileMap.has(u.id)) {
        await supabaseAdmin.from("profiles").insert({
          id: u.id,
          email: u.email ?? null,
          full_name: (u.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        });
      }
    }

    return users.map(u => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        fullName: p?.full_name ?? (u.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        createdAt: u.created_at,
        credits: p?.credits ?? 0,
        cvsGenerated: p?.cvs_generated ?? 0,
        isAdmin: (roleMap.get(u.id) ?? []).includes("admin"),
      };
    });
  });

export const revokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("No podés revocar tu propia cuenta.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    return { ok: true };
  });


export const grantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), amount: z.number().int().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", data.userId)
      .single();
    if (error) throw new Error(error.message);
    const newTotal = (profile.credits ?? 0) + data.amount;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ credits: newTotal })
      .eq("id", data.userId);
    if (updateError) throw new Error(updateError.message);
    return { credits: newTotal };
  });
