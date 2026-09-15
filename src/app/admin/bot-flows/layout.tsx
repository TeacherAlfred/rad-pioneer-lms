import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bot Flows",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
