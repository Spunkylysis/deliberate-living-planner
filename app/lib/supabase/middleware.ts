import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request. Deliberately
 * does NOT make auth-based redirect decisions here anymore.
 *
 * Next.js 16 changed proxy.ts's default runtime to Node.js and its own
 * guidance is explicit that auth redirects belong in Layouts/Route
 * Handlers, not the proxy layer — there's a documented "Logout Loop"
 * failure mode specifically for Supabase-style session-refresh code
 * placed here. Confirmed the hard way: this file previously redirected
 * unauthenticated visitors to /login itself, which caused an infinite
 * redirect loop on /login specifically once deployed under Next.js 16.
 *
 * The actual protection already exists correctly, independent of this
 * file: app/(app)/layout.tsx checks auth and redirects to /login as a
 * Server Component, which is exactly where Next.js 16 says this
 * belongs. This function's only job now is keeping the session cookie
 * fresh so that check has accurate data to work with.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Calling getUser() here is what actually triggers the token refresh
  // and cookie sync above — still needed, even though we no longer act
  // on the result to redirect.
  await supabase.auth.getUser();

  return supabaseResponse;
}
