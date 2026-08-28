import AdminNotificationListener from "@/components/admin/AdminNotificationListener";
import AdminLeadsChrome from "@/components/admin/AdminLeadsChrome";
import AdminFinanceChrome from "@/components/admin/AdminFinanceChrome";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Renders whatever specific admin page you are currently on - each
          Chrome adds its own grouped hover sidebar only within its own
          section (leads/messages/kids vs. finance-v2/pricing/money-admin),
          untouched everywhere else. The two section prefix lists never
          overlap, so nesting them is safe. */}
      <AdminFinanceChrome>
        <AdminLeadsChrome>{children}</AdminLeadsChrome>
      </AdminFinanceChrome>

      {/* This runs in the background across ALL admin pages */}
      <AdminNotificationListener />
    </>
  );
}