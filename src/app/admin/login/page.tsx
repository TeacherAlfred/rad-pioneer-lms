"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // We send this to a Server Action to set a secure HttpOnly cookie
    const res = await fetch("/api/admin-auth", {
      method: "POST",
      body: JSON.stringify({ password }),
    });

    if (res.ok) router.push("/admin/irene-entry");
    else alert("Access Denied");
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleLogin} className="p-8 bg-white rounded-2xl shadow-xl">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-2 rounded" />
        <button className="ml-2 bg-blue-600 text-white px-4 py-2 rounded">Login</button>
      </form>
    </div>
  );
}