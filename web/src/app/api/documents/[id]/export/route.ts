import { requireUser } from "@/lib/current-user";
import { exportDocument, type ExportFormat } from "@/lib/export-file";
import { getStore } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const document = getStore().getAccessibleDocument(user.id, id);
  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const requested = new URL(request.url).searchParams.get("format");
  const format: ExportFormat =
    requested === "txt" ? "txt" : requested === "pdf" ? "pdf" : "md";
  const file = exportDocument({
    title: document.title,
    contentHtml: document.contentHtml,
    format,
  });

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
