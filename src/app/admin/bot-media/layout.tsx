import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bot Media",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
