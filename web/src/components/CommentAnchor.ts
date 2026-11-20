import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Stable highlight in the document. Offsets would drift on every keystroke;
 * a mark with commentId stays on the words even as the paragraph moves.
 */
export const CommentAnchor = Mark.create({
  name: "commentAnchor",
  inclusive: false,
  addAttributes() {
    return {
      commentId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({
        "data-comment-id": HTMLAttributes.commentId,
        class: "comment-anchor",
      }),
      0,
    ];
  },
});
