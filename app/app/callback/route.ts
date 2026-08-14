import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Hit when the person clicks the magic-link email. Exchanges the
 * one-time code for a real session (sets the auth cookie), then
 * sends them on to "/" — which itself routes to onboarding or the
 * grid depending on whether they've joined a household yet.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
