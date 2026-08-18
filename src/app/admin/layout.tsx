import AdminNotificationListener from "@/components/admin/AdminNotificationListener";
import AdminLeadsChrome from "@/components/admin/AdminLeadsChrome";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Renders whatever specific admin page you are currently on - adds
          the grouped hover sidebar only on the leads/messages/kids pages,
          untouched everywhere else (see AdminLeadsChrome). */}
      <AdminLeadsChrome>{children}</AdminLeadsChrome>

      {/* This runs in the background across ALL admin pages */}
      <AdminNotificationListener />
    </>
  );
}