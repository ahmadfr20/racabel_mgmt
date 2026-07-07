import { handle, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
