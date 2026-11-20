import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id, commentId } = await params;
  const result = getStore().deleteComment({
    userId: user.id,
    documentId: id,
    commentId,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ok: true });
}
