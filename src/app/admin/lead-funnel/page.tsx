import { redirect } from "next/navigation";

// Overview is the section's landing/dashboard view - the at-a-glance read
// before drilling into the full list (now at /admin/lead-funnel/list),
// stages, messages, etc. Every generic "back to the funnel" link in the
// admin app points at this bare route, so they all land here now too.
export default function LeadFunnelIndexPage() {
  redirect("/admin/lead-funnel/overview");
}
