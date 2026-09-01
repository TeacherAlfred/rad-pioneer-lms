import AdminNotificationListener from "@/components/admin/AdminNotificationListener";
import AdminLeadsChrome from "@/components/admin/AdminLeadsChrome";
import AdminFinanceChrome from "@/components/admin/AdminFinanceChrome";
import AdminProjectsChrome from "@/components/admin/AdminProjectsChrome";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Renders whatever specific admin page you are currently on - each
          Chrome adds its own grouped hover sidebar only within its own
          section (leads/messages/kids vs. finance-v2/pricing/money-admin vs.
          dashboard-v2/projects), untouched everywhere else. The three
          section prefix lists never overlap, so nesting them is safe. */}
      <AdminFinanceChrome>
        <AdminLeadsChrome>
          <AdminProjectsChrome>{children}</AdminProjectsChrome>
        </AdminLeadsChrome>
      </AdminFinanceChrome>

      {/* This runs in the background across ALL admin pages */}
      <AdminNotificationListener />
    </>
  );
}