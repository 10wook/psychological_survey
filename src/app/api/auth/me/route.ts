import { getCurrentUser } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
