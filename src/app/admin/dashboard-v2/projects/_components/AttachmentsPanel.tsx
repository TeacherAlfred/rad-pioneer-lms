"use client";

import { useRef, useState } from "react";
import { FileText, Link2, Trash2, Upload, Download } from "lucide-react";

export type Attachment = {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  r2_key: string | null;
  external_url: string | null;
  uploaded_at: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ projectId, attachments, onChange }: { projectId: string; attachments: Attachment[]; onChange: (attachments: Attachment[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ filename: "", external_url: "" });

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", projectId);
      const uploadRes = await fetch("/api/storage/upload-project-attachment", { method: "POST", body: formData });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploaded.error);

      const res = await fetch(`/admin/api/dashboard-v2/projects/${projectId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploaded.filename,
          content_type: uploaded.content_type,
          size_bytes: uploaded.size_bytes,
          r2_key: uploaded.key,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange([json.attachment, ...attachments]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveLink() {
    if (!linkDraft.filename.trim() || !linkDraft.external_url.trim()) return;
    const res = await fetch(`/admin/api/dashboard-v2/projects/${projectId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: linkDraft.filename.trim(), external_url: linkDraft.external_url.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return;
    onChange([json.attachment, ...attachments]);
    setLinkDraft({ filename: "", external_url: "" });
    setLinking(false);
  }

  async function removeAttachment(attachment: Attachment) {
    onChange(attachments.filter((a) => a.id !== attachment.id));
    await fetch(`/admin/api/dashboard-v2/projects/${projectId}/attachments/${attachment.id}`, { method: "DELETE" });
  }

  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
      <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Documents & Links</h2>

      <div className="space-y-2 mb-4">
        {attachments.length === 0 && <p className="text-sm text-stone-400">No attachments yet.</p>}
        {attachments.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
            <div className="flex items-center gap-2 min-w-0">
              {a.r2_key ? <FileText size={15} className="text-blue-600 shrink-0" /> : <Link2 size={15} className="text-blue-600 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-800 truncate">{a.filename}</p>
                {a.size_bytes ? <p className="text-[10px] text-stone-400">{formatSize(a.size_bytes)}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {a.r2_key ? (
                <a
                  href={`/api/storage/project-attachment?key=${encodeURIComponent(a.r2_key)}&filename=${encodeURIComponent(a.filename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-white"
                  title="Download"
                >
                  <Download size={14} />
                </a>
              ) : (
                <a
                  href={a.external_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-white"
                  title="Open link"
                >
                  <Link2 size={14} />
                </a>
              )}
              <button onClick={() => removeAttachment(a)} className="p-2 rounded-lg text-stone-300 hover:text-rose-500" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {linking ? (
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-2">
          <input
            value={linkDraft.filename}
            onChange={(e) => setLinkDraft((d) => ({ ...d, filename: e.target.value }))}
            placeholder="Label, e.g. Design doc"
            className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
          />
          <input
            value={linkDraft.external_url}
            onChange={(e) => setLinkDraft((d) => ({ ...d, external_url: e.target.value }))}
            placeholder="https:// or path to a .md file"
            className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={saveLink}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Save Link
            </button>
            <button
              onClick={() => setLinking(false)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-600 disabled:opacity-50"
          >
            <Upload size={13} />
            {uploading ? "Uploading..." : "Upload File"}
          </button>
          <button
            onClick={() => setLinking(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-600"
          >
            <Link2 size={13} />
            Add Link
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] || null)} />
        </div>
      )}
    </div>
  );
}
