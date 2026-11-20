"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { CommentAnchor } from "./CommentAnchor";

type DocumentEditorProps = {
  initialHtml: string;
  onChange: (html: string) => void;
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string) => void;
  onStartComment?: (input: { commentId: string; quote: string }) => void;
};

export function DocumentEditor({
  initialHtml,
  onChange,
  activeCommentId,
  onSelectComment,
  onStartComment,
}: DocumentEditorProps) {
  const onSelectCommentRef = useRef(onSelectComment);
  onSelectCommentRef.current = onSelectComment;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
      CommentAnchor,
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "min-h-[55vh]",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return false;
        }
        const anchor = target.closest("[data-comment-id]");
        const commentId = anchor?.getAttribute("data-comment-id");
        if (commentId) {
          onSelectCommentRef.current?.(commentId);
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    const root = document.querySelector(".paper-editor");
    root?.querySelectorAll("span.comment-anchor").forEach((node) => {
      node.classList.toggle(
        "is-active",
        node.getAttribute("data-comment-id") === activeCommentId,
      );
    });
  }, [activeCommentId, editor]);

  if (!editor) {
    return <p className="text-muted">Loading editor…</p>;
  }

  return (
    <div className="paper-editor">
      <div className="sticky top-0 z-10 mb-6 flex flex-wrap gap-1 border-b border-rule bg-paper py-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="H1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="Bullets"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbers"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Comment"
          active={false}
          onClick={() => {
            const { from, to, empty } = editor.state.selection;
            const commentId = crypto.randomUUID();
            const quote = empty ? "" : editor.state.doc.textBetween(from, to, " ");
            if (!empty) {
              editor.chain().focus().setMark("commentAnchor", { commentId }).run();
            }
            onStartComment?.({ commentId: empty ? "" : commentId, quote });
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-sm ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-paper-raised"
      }`}
    >
      {label}
    </button>
  );
}
