import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sent Messages",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
