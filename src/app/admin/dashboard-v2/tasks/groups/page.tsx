"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";

type Group = { id: string; name: string; color: string | null };

export default function TaskGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const res = await fetch("/admin/api/dashboard-v2/tasks/groups");
    const json = await res.json();
    setGroups(json.groups || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addGroup() {
    const name = newName.trim();
    if (!name) return;
    await fetch("/admin/api/dashboard-v2/tasks/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    await load();
  }

  function startEdit(g: Group) {
    setEditingId(g.id);
    setEditName(g.name);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    await fetch(`/admin/api/dashboard-v2/tasks/groups/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    await load();
  }

  async function removeGroup(id: string) {
    await fetch(`/admin/api/dashboard-v2/tasks/groups/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        <DashboardV2Nav />

        <div>
          <Link
            href="/admin/dashboard-v2/tasks"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Tasks
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Task Groups</h1>
          <p className="text-stone-500 text-sm mt-1">Tasks can carry more than one group tag, or none at all.</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-2 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
            placeholder="New group name..."
            className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none"
          />
          <button
            onClick={addGroup}
            disabled={!newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 shrink-0"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm divide-y divide-stone-100">
          {groups.length === 0 && <p className="p-6 text-sm text-stone-400">No groups yet.</p>}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 p-4">
              {editingId === g.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  onBlur={saveEdit}
                  autoFocus
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm"
                />
              ) : (
                <span className="text-sm font-bold text-stone-800">{g.name}</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(g)} className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50">
                  <Pencil size={14} />
                </button>
                <button onClick={() => removeGroup(g.id)} className="p-2 rounded-lg text-stone-300 hover:text-rose-500 hover:bg-stone-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
