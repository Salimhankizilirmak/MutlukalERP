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
  if (process.env.VERCEL) {
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  }
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (process.env.VERCEL) {
    try {
      return JSON.parse(decodeURIComponent(atob(token))) as SessionPayload;
    } catch {
      return null;
    }
  }
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Hem http hem de https ortamlarında sorunsuz çalışma garantisi
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
