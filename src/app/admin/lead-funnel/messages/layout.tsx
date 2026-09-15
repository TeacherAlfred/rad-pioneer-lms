import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Message Activity",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
