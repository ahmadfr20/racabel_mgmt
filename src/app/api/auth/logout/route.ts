import { handle, ok } from "@/lib/api";
import { sessionCookieName } from "@/lib/session";

export const POST = handle(async () => {
  const res = ok({ success: true });
  res.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
  return res;
});
