import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "./session";
import { getStore } from "./store";

export async function requireUser() {
  const cookieStore = await cookies();
  const userId = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return null;
  }
  return getStore().getUser(userId);
}
