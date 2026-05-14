import AdminNotificationListener from "@/components/admin/AdminNotificationListener";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* This renders whatever specific admin page you are currently on */}
      {children}
      
      {/* This runs in the background across ALL admin pages */}
      <AdminNotificationListener />
    </>
  );
}