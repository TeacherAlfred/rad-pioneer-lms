import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Call Queue",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
