import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lead Journey",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
