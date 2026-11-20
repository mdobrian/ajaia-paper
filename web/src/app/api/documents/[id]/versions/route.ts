import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const result = getStore().listVersions({
    userId: user.id,
    documentId: id,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ versions: result.versions });
}
