import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id, commentId } = await params;
  const payload = (await request.json().catch(() => ({}))) as { note?: unknown };
  const result = getStore().resolveComment({
    userId: user.id,
    documentId: id,
    commentId,
    note: typeof payload.note === "string" ? payload.note : "",
  });
  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ comment: result.comment });
}
