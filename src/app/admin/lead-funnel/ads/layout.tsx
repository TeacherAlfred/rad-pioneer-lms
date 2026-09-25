import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ad Campaigns",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
