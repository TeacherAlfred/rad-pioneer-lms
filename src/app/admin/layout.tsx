import type { Metadata } from "next";
import AdminNotificationListener from "@/components/admin/AdminNotificationListener";
import InboundMessageAlert from "@/components/admin/InboundMessageAlert";
import AdminLeadsChrome from "@/components/admin/AdminLeadsChrome";
import AdminFinanceChrome from "@/components/admin/AdminFinanceChrome";
import AdminProjectsChrome from "@/components/admin/AdminProjectsChrome";
import AdminSystemStatusChrome from "@/components/admin/AdminSystemStatusChrome";
import AdminProgramsChrome from "@/components/admin/AdminProgramsChrome";

export const metadata: Metadata = {
  title: {
    template: "%s · Admin",
    default: "RAD Admin",
  },
};

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
          dashboard-v2/projects vs. dashboard-v2/systems-status+landmines vs.
          featured-programs/registrations/term-program-settings), untouched
          everywhere else. The five section prefix lists never overlap, so
          nesting them is safe. */}
      <AdminFinanceChrome>
        <AdminLeadsChrome>
          <AdminProjectsChrome>
            <AdminSystemStatusChrome>
              <AdminProgramsChrome>{children}</AdminProgramsChrome>
            </AdminSystemStatusChrome>
          </AdminProjectsChrome>
        </AdminLeadsChrome>
      </AdminFinanceChrome>

      {/* This runs in the background across ALL admin pages */}
      <AdminNotificationListener />
      <InboundMessageAlert />
    </>
  );
}