import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  return Response.json({ library: getStore().listLibrary(user.id) });
}

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const created = getStore().createDocument({ ownerId: user.id });
  if (!created.ok) {
    return Response.json({ error: created.error }, { status: 400 });
  }
  return Response.json({ document: created.document });
}
