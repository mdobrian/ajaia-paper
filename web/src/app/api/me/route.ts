import { requireUser } from "@/lib/current-user";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  return Response.json({ user });
}
