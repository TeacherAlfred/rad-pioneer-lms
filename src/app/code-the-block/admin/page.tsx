import { isCtbAdmin } from "@/lib/code-the-block/session";
import { AdminLoginForm } from "@/components/code-the-block/AdminLoginForm";
import { AdminDashboard } from "@/components/code-the-block/AdminDashboard";

export default async function CodeTheBlockAdminPage() {
  const admin = await isCtbAdmin();
  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-950">
        <AdminLoginForm />
      </div>
    );
  }

  return <AdminDashboard />;
}
