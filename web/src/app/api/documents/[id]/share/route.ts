import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const result = getStore().shareDocument({
    documentId: id,
    ownerId: user.id,
    recipientEmail: body.email ?? "",
  });

  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN"
        ? 403
        : result.code === "NOT_FOUND"
          ? 404
          : 400;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true });
}
