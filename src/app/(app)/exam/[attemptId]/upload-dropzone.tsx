"use client";

import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import type { AttemptStatus } from "../../../../adapters/supabase/attempts";
import { uploadMessages } from "../../../../messages/id";
import { UPLOAD_ACCEPT, UPLOAD_ENDPOINT, pickFile, tooLarge, uploadOutcome, type UploadOutcome } from "./upload";

type DropzoneState = { kind: "ready" } | { kind: "uploading" } | { kind: "rejected"; message: string };

/**
 * Upload Dropzone (EXPERIENCE.md › Upload Dropzone, DESIGN.md
 * `upload-dropzone`, `key-exam.html`): the upload path when the Finish macro
 * is blocked (CAP-4). A real `<input type="file">`, visually hidden inside its
 * label, so `Tab` reaches it and `Enter`/`Space` opens the picker; dragging a
 * file onto it is optional. One file is sent (the first), as the raw body
 * (`application/octet-stream`), to `POST /api/submissions/upload`: the file's
 * token names the attempt (AD-6), so no id travels with it.
 *
 * Uploading: "Uploading…" (polite) with an indeterminate bar (`fetch` reports
 * no upload progress), input disabled. Rejected: the reason in `role="alert"`
 * with the pick-again control. Accepted or duplicate: `onReceived(status)`,
 * and the exam screen moves on (the Dropzone is rendered only while `open`).
 */
export function UploadDropzone({
  onReceived,
  onSessionLost,
}: {
  onReceived: (status: AttemptStatus) => void;
  onSessionLost: () => void;
}) {
  const [state, setState] = useState<DropzoneState>({ kind: "ready" });
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploading = state.kind === "uploading";

  async function send(file: File | null) {
    if (file === null || uploading) return;
    if (tooLarge(file.size)) {
      setState({ kind: "rejected", message: uploadMessages.FILE_TOO_LARGE });
      return;
    }
    setState({ kind: "uploading" });
    let outcome: UploadOutcome;
    try {
      const res = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: file,
        cache: "no-store",
      });
      outcome = uploadOutcome(res.status, await res.json().catch(() => null));
    } catch {
      outcome = { kind: "failed" };
    }
    switch (outcome.kind) {
      case "received":
        setState({ kind: "ready" });
        onReceived(outcome.status);
        return;
      case "session_lost":
        setState({ kind: "ready" });
        onSessionLost();
        return;
      case "rejected":
        setState({ kind: "rejected", message: outcome.message });
        break;
      case "failed":
        setState({ kind: "rejected", message: uploadMessages.failed });
        break;
    }
    // Ready for the right file: the input was disabled while uploading, so give focus back.
    window.setTimeout(() => input.current?.focus(), 0);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!uploading) void send(pickFile(event.dataTransfer.files));
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    if (!uploading && !dragOver) setDragOver(true);
  }

  const rejected = state.kind === "rejected" ? state.message : null;
  const box =
    rejected !== null
      ? "flex-col items-stretch gap-2 border-[1.5px] border-solid border-destructive bg-destructive-soft px-3.5 py-3"
      : uploading
        ? "flex-col items-stretch gap-1.5 border-[1.5px] border-solid border-input-border px-3.5 py-2"
        : "items-stretch";

  return (
    <div
      className={`flex min-h-10 w-full rounded-md ${box}`}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {rejected !== null && (
        <p role="alert" lang="id" className="flex gap-2 text-[14px] font-medium leading-[1.45] text-foreground">
          <span aria-hidden="true" className="flex-none font-extrabold text-destructive">
            ✗
          </span>
          <span>{rejected}</span>
        </p>
      )}
      <div role="status" className={uploading ? "flex flex-col gap-1.5" : "sr-only"}>
        {uploading && (
          <>
            <span className="text-[12px] text-foreground">Uploading…</span>
            <span aria-hidden="true" className="upload-bar block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-1/3 rounded-full bg-primary" />
            </span>
          </>
        )}
      </div>
      <label
        className={[
          "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] px-3.5 text-[13px] font-semibold",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-ring",
          rejected !== null ? "self-start border-dashed border-input-border bg-card text-foreground" : "flex-1",
          rejected === null && dragOver
            ? "border-solid border-primary bg-glow-soft text-foreground"
            : rejected === null
              ? "border-dashed border-input-border text-muted-foreground hover:border-primary hover:text-foreground"
              : "",
          uploading ? "sr-only" : "",
        ].join(" ")}
      >
        <input
          ref={input}
          type="file"
          accept={UPLOAD_ACCEPT}
          disabled={uploading}
          className="sr-only"
          onChange={(event) => {
            const file = pickFile(event.currentTarget.files);
            // Cleared so the same file can be picked again after a rejection.
            event.currentTarget.value = "";
            void send(file);
          }}
        />
        <Upload aria-hidden="true" className="size-4" />
        {dragOver && rejected === null ? "Drop to upload" : "Upload file (.xlsm)"}
      </label>
    </div>
  );
}
