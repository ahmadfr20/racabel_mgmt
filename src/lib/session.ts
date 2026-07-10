// Edge-safe session helpers (JWT via jose, tanpa Prisma) — dipakai di middleware & server.
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "hr_session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me-untuk-produksi-minimal-32-karakter"
);
const maxAge = Number(process.env.SESSION_MAX_AGE || 28800);

export interface SessionPayload {
  sub: number; // userId
  username: string;
  role: string;
}

export const sessionCookieName = COOKIE_NAME;
export const sessionMaxAge = maxAge;

// Flag `secure` cookie. Default mengikuti production, tapi bisa dipaksa lewat
// COOKIE_SECURE (set "false" saat server masih HTTP / belum pasang SSL).
export const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: Number(payload.sub),
      username: String(payload.username ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}
