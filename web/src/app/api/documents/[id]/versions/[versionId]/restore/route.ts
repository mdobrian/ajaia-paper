import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id, versionId } = await params;
  const result = getStore().restoreVersion({
    userId: user.id,
    documentId: id,
    versionId,
  });
  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ document: result.document, isOwner: result.document.ownerId === user.id });
}
