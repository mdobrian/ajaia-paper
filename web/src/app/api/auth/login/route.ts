import { cookies } from "next/headers";
import { SESSION_COOKIE, encodeSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const result = getStore().authenticate({
    email: body.email ?? "",
    password: body.password ?? "",
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(result.user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });

  return Response.json({ user: result.user });
}
