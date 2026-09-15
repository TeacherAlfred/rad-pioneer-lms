import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Idea",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
