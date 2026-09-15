import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landmines & Risk",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
