/**
 * SQLite document store.
 *
 * Tests pass `:memory:` so each case is isolated and offline. The app will
 * point this at a file on disk so documents survive refresh.
 *
 * Import still goes through `importUploadedFile`. If conversion fails, we never
 * INSERT — a rejected .docx must not leave an empty row behind.
 *
 * Sharing is owner-only and email-based. Anyone with access can edit. Recipients
 * cannot re-share. That is enough to demonstrate access without a full ACL.
 */
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  importUploadedFile,
  type ImportErrorCode,
} from "./import-file";
import { hashPassword, verifyPassword } from "./passwords";

export type PaperDocument = {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type PaperUser = {
  id: string;
  email: string;
  name: string;
};

export type DocumentStoreErrorCode = ImportErrorCode | "OWNER_REQUIRED";

export type StoreImportResult =
  | { ok: true; document: PaperDocument }
  | { ok: false; code: DocumentStoreErrorCode; error: string };

export type CreateUserResult =
  | { ok: true; user: PaperUser }
  | { ok: false; code: "DUPLICATE_EMAIL"; error: string };

export type ShareResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "SHARE_WITH_SELF"
        | "RECIPIENT_REQUIRED"
        | "FORBIDDEN"
        | "NOT_FOUND";
      error: string;
    };

export type EditResult =
  | { ok: true; document: PaperDocument }
  | {
      ok: false;
      code: "FORBIDDEN" | "NOT_FOUND" | "TITLE_REQUIRED" | "OWNER_REQUIRED";
      error: string;
    };

export type AuthResult =
  | { ok: true; user: PaperUser }
  | { ok: false; code: "INVALID_CREDENTIALS"; error: string };

export type Library = {
  owned: PaperDocument[];
  shared: PaperDocument[];
};

export type Recipient = {
  email: string;
  name: string;
};

export type RecipientsResult =
  | { ok: true; recipients: Recipient[] }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND"; error: string };

export type DeleteResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND"; error: string };

export type DocumentVersion = {
  id: string;
  documentId: string;
  title: string;
  contentHtml: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
};

export type VersionsResult =
  | { ok: true; versions: DocumentVersion[] }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND"; error: string };

export type PaperComment = {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  quote: string;
  anchorId: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type CommentResult =
  | { ok: true; comment: PaperComment }
  | {
      ok: false;
      code: "FORBIDDEN" | "NOT_FOUND" | "COMMENT_REQUIRED";
      error: string;
    };

export type CommentsResult =
  | { ok: true; comments: PaperComment[] }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND"; error: string };

export type DocumentStore = {
  createUser(input: {
    email: string;
    name: string;
    password?: string;
  }): CreateUserResult;
  authenticate(input: { email: string; password: string }): AuthResult;
  getUser(id: string): PaperUser | null;
  createDocument(input: { ownerId: string }): EditResult;
  importFile(input: {
    ownerId: string;
    filename: string;
    bytes: Uint8Array;
    repairMarkdown?: boolean;
  }): StoreImportResult;
  getDocument(id: string): PaperDocument | null;
  getAccessibleDocument(userId: string, documentId: string): PaperDocument | null;
  shareDocument(input: {
    documentId: string;
    ownerId: string;
    recipientEmail: string;
  }): ShareResult;
  unshareDocument(input: {
    documentId: string;
    ownerId: string;
    recipientEmail: string;
  }): ShareResult;
  listRecipients(input: {
    userId: string;
    documentId: string;
  }): RecipientsResult;
  deleteDocument(input: { userId: string; documentId: string }): DeleteResult;
  leaveDocument(input: { userId: string; documentId: string }): DeleteResult;
  duplicateDocument(input: { userId: string; documentId: string }): EditResult;
  renameDocument(input: {
    userId: string;
    documentId: string;
    title: string;
  }): EditResult;
  saveContent(input: {
    userId: string;
    documentId: string;
    contentHtml: string;
  }): EditResult;
  listVersions(input: { userId: string; documentId: string }): VersionsResult;
  restoreVersion(input: {
    userId: string;
    documentId: string;
    versionId: string;
  }): EditResult;
  addComment(input: {
    userId: string;
    documentId: string;
    body: string;
    quote?: string;
    anchorId?: string;
  }): CommentResult;
  listComments(input: { userId: string; documentId: string }): CommentsResult;
  resolveComment(input: {
    userId: string;
    documentId: string;
    commentId: string;
  }): CommentResult;
  deleteComment(input: {
    userId: string;
    documentId: string;
    commentId: string;
  }): DeleteResult;
  listLibrary(userId: string): Library;
  listDocumentIds(): string[];
  close(): void;
};

type DocumentRow = {
  id: string;
  title: string;
  content_html: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

const INVALID_CREDENTIALS: AuthResult = {
  ok: false,
  code: "INVALID_CREDENTIALS",
  error: "Email or password is incorrect.",
};

export function createDocumentStore(filename = ":memory:"): DocumentStore {
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_html TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_html TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      quote TEXT NOT NULL DEFAULT '',
      anchor_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
  );
  const selectUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
  const selectUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
  const insertDocument = db.prepare(`
    INSERT INTO documents (id, title, content_html, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const selectById = db.prepare(`SELECT * FROM documents WHERE id = ?`);
  const selectIds = db.prepare(`SELECT id FROM documents ORDER BY created_at ASC`);
  const selectOwned = db.prepare(
    `SELECT * FROM documents WHERE owner_id = ? ORDER BY created_at ASC`,
  );
  const selectShared = db.prepare(`
    SELECT documents.*
    FROM documents
    INNER JOIN shares ON shares.document_id = documents.id
    WHERE shares.user_id = ?
    ORDER BY documents.created_at ASC
  `);
  const selectAccessible = db.prepare(`
    SELECT * FROM documents
    WHERE id = ?
      AND (
        owner_id = ?
        OR id IN (SELECT document_id FROM shares WHERE user_id = ?)
      )
  `);
  const insertShare = db.prepare(`
    INSERT OR IGNORE INTO shares (document_id, user_id, created_at)
    VALUES (?, ?, ?)
  `);
  const deleteShare = db.prepare(
    `DELETE FROM shares WHERE document_id = ? AND user_id = ?`,
  );
  const deleteSharesForDocument = db.prepare(
    `DELETE FROM shares WHERE document_id = ?`,
  );
  const deleteDocumentRow = db.prepare(`DELETE FROM documents WHERE id = ?`);
  const selectRecipients = db.prepare(`
    SELECT users.email, users.name
    FROM shares
    INNER JOIN users ON users.id = shares.user_id
    WHERE shares.document_id = ?
    ORDER BY users.email ASC
  `);
  const updateTitle = db.prepare(
    `UPDATE documents SET title = ?, updated_at = ? WHERE id = ?`,
  );
  const updateContent = db.prepare(
    `UPDATE documents SET content_html = ?, updated_at = ? WHERE id = ?`,
  );
  const insertVersion = db.prepare(`
    INSERT INTO versions (id, document_id, title, content_html, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateVersionTitle = db.prepare(
    `UPDATE versions SET title = ? WHERE id = ?`,
  );
  const selectLatestVersion = db.prepare(`
    SELECT * FROM versions WHERE document_id = ? ORDER BY rowid DESC LIMIT 1
  `);
  const selectVersions = db.prepare(`
    SELECT versions.*, users.name AS created_by_name
    FROM versions
    LEFT JOIN users ON users.id = versions.created_by
    WHERE versions.document_id = ?
    ORDER BY versions.rowid DESC
  `);
  const selectVersionById = db.prepare(`SELECT * FROM versions WHERE id = ?`);
  const deleteVersionsForDocument = db.prepare(
    `DELETE FROM versions WHERE document_id = ?`,
  );
  const insertComment = db.prepare(`
    INSERT INTO comments (
      id, document_id, author_id, body, quote, anchor_id, created_at, resolved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  const selectComments = db.prepare(`
    SELECT comments.*, users.name AS author_name, users.email AS author_email
    FROM comments
    INNER JOIN users ON users.id = comments.author_id
    WHERE comments.document_id = ?
    ORDER BY comments.rowid ASC
  `);
  const selectCommentById = db.prepare(`
    SELECT comments.*, users.name AS author_name, users.email AS author_email
    FROM comments
    INNER JOIN users ON users.id = comments.author_id
    WHERE comments.id = ?
  `);
  const resolveCommentRow = db.prepare(
    `UPDATE comments SET resolved_at = ? WHERE id = ?`,
  );
  const deleteCommentRow = db.prepare(`DELETE FROM comments WHERE id = ?`);
  const deleteCommentsForDocument = db.prepare(
    `DELETE FROM comments WHERE document_id = ?`,
  );

  type CommentRow = {
    id: string;
    document_id: string;
    author_id: string;
    body: string;
    quote: string;
    anchor_id: string;
    created_at: string;
    resolved_at: string | null;
    author_name: string;
    author_email: string;
  };

  function rowToComment(row: CommentRow): PaperComment {
    return {
      id: row.id,
      documentId: row.document_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      body: row.body,
      quote: row.quote,
      anchorId: row.anchor_id,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  }

  type VersionRow = {
    id: string;
    document_id: string;
    title: string;
    content_html: string;
    created_at: string;
    created_by: string;
    created_by_name?: string;
  };

  function rowToVersion(row: VersionRow): DocumentVersion {
    return {
      id: row.id,
      documentId: row.document_id,
      title: row.title,
      contentHtml: row.content_html,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name ?? "",
    };
  }

  function snapshot(
    document: PaperDocument,
    userId: string,
    contentChanged: boolean,
  ) {
    const latest = selectLatestVersion.get(document.id) as VersionRow | undefined;
    if (!latest) {
      insertVersion.run(
        randomUUID(),
        document.id,
        document.title,
        document.contentHtml,
        document.updatedAt,
        userId,
      );
      return;
    }
    if (latest.title === document.title && latest.content_html === document.contentHtml) {
      return;
    }
    if (!contentChanged) {
      updateVersionTitle.run(document.title, latest.id);
      return;
    }
    insertVersion.run(
      randomUUID(),
      document.id,
      document.title,
      document.contentHtml,
      document.updatedAt,
      userId,
    );
  }

  function requireAccessible(userId: string, documentId: string): EditResult {
    const existing = selectById.get(documentId.trim()) as DocumentRow | undefined;
    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Document not found.",
      };
    }
    const accessible = selectAccessible.get(
      documentId.trim(),
      userId.trim(),
      userId.trim(),
    ) as DocumentRow | undefined;
    if (!accessible) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "You do not have access to this document.",
      };
    }
    return { ok: true, document: rowToDocument(accessible) };
  }

  return {
    createUser({ email, name, password }) {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();
      if (selectUserByEmail.get(normalizedEmail)) {
        return {
          ok: false,
          code: "DUPLICATE_EMAIL",
          error: "A user with that email already exists.",
        };
      }

      const user: PaperUser = {
        id: randomUUID(),
        email: normalizedEmail,
        name: trimmedName,
      };
      insertUser.run(
        user.id,
        user.email,
        user.name,
        password ? hashPassword(password) : "",
      );
      return { ok: true, user };
    },

    authenticate({ email, password }) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return INVALID_CREDENTIALS;
      }

      const row = selectUserByEmail.get(normalizedEmail) as UserRow | undefined;
      // Same error whether the email is missing or the password is wrong.
      if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) {
        return INVALID_CREDENTIALS;
      }
      return { ok: true, user: rowToUser(row) };
    },

    getUser(id) {
      const trimmed = id.trim();
      if (!trimmed) {
        return null;
      }
      const row = selectUserById.get(trimmed) as UserRow | undefined;
      return row ? rowToUser(row) : null;
    },

    createDocument({ ownerId }) {
      const owner = ownerId.trim();
      if (!owner) {
        return {
          ok: false,
          code: "OWNER_REQUIRED",
          error: "An owner is required to create a document.",
        };
      }

      const now = new Date().toISOString();
      const document: PaperDocument = {
        id: randomUUID(),
        title: "Untitled",
        contentHtml: "<p></p>",
        ownerId: owner,
        createdAt: now,
        updatedAt: now,
      };
      insertDocument.run(
        document.id,
        document.title,
        document.contentHtml,
        document.ownerId,
        document.createdAt,
        document.updatedAt,
      );
      snapshot(document, owner, true);
      return { ok: true, document };
    },

    importFile({ ownerId, filename: uploadName, bytes, repairMarkdown: shouldRepair }) {
      const owner = ownerId.trim();
      if (!owner) {
        return {
          ok: false,
          code: "OWNER_REQUIRED",
          error: "An owner is required to import a document.",
        };
      }

      const imported = importUploadedFile({
        filename: uploadName,
        bytes,
        repairMarkdown: shouldRepair,
      });
      if (!imported.ok) {
        return imported;
      }

      const now = new Date().toISOString();
      const document: PaperDocument = {
        id: randomUUID(),
        title: imported.title,
        contentHtml: imported.contentHtml,
        ownerId: owner,
        createdAt: now,
        updatedAt: now,
      };

      insertDocument.run(
        document.id,
        document.title,
        document.contentHtml,
        document.ownerId,
        document.createdAt,
        document.updatedAt,
      );
      snapshot(document, owner, true);

      return { ok: true, document };
    },

    getDocument(id) {
      const trimmed = id.trim();
      if (!trimmed) {
        return null;
      }

      const row = selectById.get(trimmed) as DocumentRow | undefined;
      return row ? rowToDocument(row) : null;
    },

    getAccessibleDocument(userId, documentId) {
      const user = userId.trim();
      const id = documentId.trim();
      if (!user || !id) {
        return null;
      }

      const row = selectAccessible.get(id, user, user) as DocumentRow | undefined;
      return row ? rowToDocument(row) : null;
    },

    shareDocument({ documentId, ownerId, recipientEmail }) {
      const email = recipientEmail.trim().toLowerCase();
      if (!email) {
        return {
          ok: false,
          code: "RECIPIENT_REQUIRED",
          error: "An email is required to share.",
        };
      }

      const row = selectById.get(documentId.trim()) as DocumentRow | undefined;
      if (!row) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Document not found.",
        };
      }
      const document = rowToDocument(row);

      if (document.ownerId !== ownerId.trim()) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the owner can share this document.",
        };
      }

      const recipient = selectUserByEmail.get(email) as UserRow | undefined;
      if (!recipient) {
        return {
          ok: false,
          code: "USER_NOT_FOUND",
          error: "No user exists with that email.",
        };
      }

      if (recipient.id === document.ownerId) {
        return {
          ok: false,
          code: "SHARE_WITH_SELF",
          error: "You already own this document.",
        };
      }

      // INSERT OR IGNORE keeps a second share of the same person a no-op.
      insertShare.run(document.id, recipient.id, new Date().toISOString());
      return { ok: true };
    },

    unshareDocument({ documentId, ownerId, recipientEmail }) {
      const email = recipientEmail.trim().toLowerCase();
      if (!email) {
        return {
          ok: false,
          code: "RECIPIENT_REQUIRED",
          error: "An email is required to unshare.",
        };
      }

      const row = selectById.get(documentId.trim()) as DocumentRow | undefined;
      if (!row) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Document not found.",
        };
      }
      const document = rowToDocument(row);
      if (document.ownerId !== ownerId.trim()) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the owner can unshare this document.",
        };
      }

      const recipient = selectUserByEmail.get(email) as UserRow | undefined;
      if (!recipient) {
        return {
          ok: false,
          code: "USER_NOT_FOUND",
          error: "No user exists with that email.",
        };
      }

      deleteShare.run(document.id, recipient.id);
      return { ok: true };
    },

    leaveDocument({ userId, documentId }) {
      const row = selectById.get(documentId.trim()) as DocumentRow | undefined;
      if (!row) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Document not found.",
        };
      }
      if (row.owner_id === userId.trim()) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Owners cannot leave. Delete the document instead.",
        };
      }

      const accessible = selectAccessible.get(
        row.id,
        userId.trim(),
        userId.trim(),
      ) as DocumentRow | undefined;
      if (!accessible) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "You do not have access to this document.",
        };
      }

      deleteShare.run(row.id, userId.trim());
      return { ok: true };
    },

    duplicateDocument({ userId, documentId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }

      const now = new Date().toISOString();
      const document: PaperDocument = {
        id: randomUUID(),
        title: `Copy of ${access.document.title}`,
        contentHtml: access.document.contentHtml,
        ownerId: userId.trim(),
        createdAt: now,
        updatedAt: now,
      };
      insertDocument.run(
        document.id,
        document.title,
        document.contentHtml,
        document.ownerId,
        document.createdAt,
        document.updatedAt,
      );
      snapshot(document, document.ownerId, true);
      return { ok: true, document };
    },

    listRecipients({ userId, documentId }) {
      const row = selectById.get(documentId.trim()) as DocumentRow | undefined;
      if (!row) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Document not found.",
        };
      }
      if (row.owner_id !== userId.trim()) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the owner can share this document.",
        };
      }

      const recipients = selectRecipients.all(row.id) as Recipient[];
      return { ok: true, recipients };
    },

    deleteDocument({ userId, documentId }) {
      const row = selectById.get(documentId.trim()) as DocumentRow | undefined;
      if (!row) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Document not found.",
        };
      }
      if (row.owner_id !== userId.trim()) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the owner can delete this document.",
        };
      }

      deleteSharesForDocument.run(row.id);
      deleteVersionsForDocument.run(row.id);
      deleteCommentsForDocument.run(row.id);
      deleteDocumentRow.run(row.id);
      return { ok: true };
    },

    renameDocument({ userId, documentId, title }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          ok: false,
          code: "TITLE_REQUIRED",
          error: "A title is required.",
        };
      }

      const now = new Date().toISOString();
      const document = { ...access.document, title: trimmedTitle, updatedAt: now };
      updateTitle.run(trimmedTitle, now, access.document.id);
      snapshot(document, userId.trim(), false);
      return { ok: true, document };
    },

    saveContent({ userId, documentId, contentHtml }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }

      const cleaned = sanitizeHtml(contentHtml);
      const now = new Date().toISOString();
      const document = { ...access.document, contentHtml: cleaned, updatedAt: now };
      updateContent.run(cleaned, now, access.document.id);
      snapshot(document, userId.trim(), true);
      return { ok: true, document };
    },

    listVersions({ userId, documentId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }
      const versions = (selectVersions.all(access.document.id) as VersionRow[]).map(
        rowToVersion,
      );
      return { ok: true, versions };
    },

    restoreVersion({ userId, documentId, versionId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }
      const row = selectVersionById.get(versionId.trim()) as VersionRow | undefined;
      if (!row || row.document_id !== access.document.id) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Version not found.",
        };
      }
      const now = new Date().toISOString();
      updateTitle.run(row.title, now, access.document.id);
      updateContent.run(row.content_html, now, access.document.id);
      const document = {
        ...access.document,
        title: row.title,
        contentHtml: row.content_html,
        updatedAt: now,
      };
      snapshot(document, userId.trim(), true);
      return { ok: true, document };
    },

    addComment({ userId, documentId, body, quote, anchorId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }
      const trimmed = body.trim();
      if (!trimmed) {
        return {
          ok: false,
          code: "COMMENT_REQUIRED",
          error: "A comment is required.",
        };
      }
      const author = selectUserById.get(userId.trim()) as UserRow | undefined;
      if (!author) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "You do not have access to this document.",
        };
      }
      const comment: PaperComment = {
        id: randomUUID(),
        documentId: access.document.id,
        authorId: author.id,
        authorName: author.name,
        authorEmail: author.email,
        body: trimmed,
        quote: (quote ?? "").trim(),
        anchorId: (anchorId ?? "").trim(),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      insertComment.run(
        comment.id,
        comment.documentId,
        comment.authorId,
        comment.body,
        comment.quote,
        comment.anchorId,
        comment.createdAt,
      );
      return { ok: true, comment };
    },

    listComments({ userId, documentId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }
      const comments = (selectComments.all(access.document.id) as CommentRow[]).map(
        rowToComment,
      );
      return { ok: true, comments };
    },

    resolveComment({ userId, documentId, commentId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return access;
      }
      const row = selectCommentById.get(commentId.trim()) as CommentRow | undefined;
      if (!row || row.document_id !== access.document.id) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Comment not found.",
        };
      }
      const resolvedAt = row.resolved_at ?? new Date().toISOString();
      if (!row.resolved_at) {
        resolveCommentRow.run(resolvedAt, row.id);
      }
      return { ok: true, comment: { ...rowToComment(row), resolvedAt } };
    },

    deleteComment({ userId, documentId, commentId }) {
      const access = requireAccessible(userId, documentId);
      if (!access.ok) {
        return {
          ok: false,
          code: access.code === "NOT_FOUND" ? "NOT_FOUND" : "FORBIDDEN",
          error: access.error,
        };
      }
      const row = selectCommentById.get(commentId.trim()) as CommentRow | undefined;
      if (!row || row.document_id !== access.document.id) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Comment not found.",
        };
      }
      const actor = userId.trim();
      if (row.author_id !== actor && access.document.ownerId !== actor) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the commenter or owner can delete this comment.",
        };
      }
      deleteCommentRow.run(row.id);
      return { ok: true };
    },

    listLibrary(userId) {
      const user = userId.trim();
      if (!user) {
        return { owned: [], shared: [] };
      }

      const owned = (selectOwned.all(user) as DocumentRow[]).map(rowToDocument);
      const shared = (selectShared.all(user) as DocumentRow[]).map(rowToDocument);
      return { owned, shared };
    },

    listDocumentIds() {
      const rows = selectIds.all() as Array<{ id: string }>;
      return rows.map((row) => row.id);
    },

    close() {
      db.close();
    },
  };
}

function rowToDocument(row: DocumentRow): PaperDocument {
  return {
    id: row.id,
    title: row.title,
    contentHtml: row.content_html,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToUser(row: UserRow): PaperUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}

function sanitizeHtml(html: string): string {
  // Not a full sanitizer. TipTap is the authoring path; this is a backstop so a
  // crafted save payload cannot keep a <script> tag in SQLite.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}
