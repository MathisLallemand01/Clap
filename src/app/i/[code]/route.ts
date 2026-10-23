import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/** Lien de parrainage : clap.app/i/JD-7K4Q */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().slice(0, 16);
  (await cookies()).set('clap_ref', code, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 3600 });
  return NextResponse.redirect(new URL(`/connexion?mode=inscription&parrain=${encodeURIComponent(code)}`, process.env.APP_URL ?? request.nextUrl.origin));
}
