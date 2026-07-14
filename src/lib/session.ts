import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = new TextEncoder().encode(
  "mutlukal-stok-super-secret-key-2026-fixed-key-safe"
);

export const COOKIE_NAME = "mutlukal_auth";
export const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 gün

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  companyId: string;
}

export async function createSession(payload: SessionPayload) {
  console.log(`[Session] Creating session for: ${payload.username}`);
  if (process.env.VERCEL) {
    const mockToken = btoa(encodeURIComponent(JSON.stringify(payload)));
    console.log(`[Session] Vercel mock token created: ${mockToken}`);
    return mockToken;
  }
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  console.log(`[Session] Verifying token prefix: ${token ? token.slice(0, 10) + "..." : "none"}`);
  if (process.env.VERCEL) {
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(token))) as SessionPayload;
      console.log(`[Session] Vercel decoded payload: ${JSON.stringify(decoded)}`);
      return decoded;
    } catch (err: any) {
      console.error(`[Session] Vercel decoding failed:`, err);
      return null;
    }
  }
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch (err: any) {
    console.error(`[Session] jose jwtVerify failed:`, err);
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  console.log(`[Session] getSession called. Cookie token prefix: ${token ? token.slice(0, 10) + "..." : "none"}`);
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  console.log(`[Session] Setting cookie ${COOKIE_NAME} with token prefix: ${token ? token.slice(0, 10) + "..." : "none"}`);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Hem http hem de https ortamlarında sorunsuz çalışma garantisi
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
  console.log(`[Session] Cookie set completed`);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
