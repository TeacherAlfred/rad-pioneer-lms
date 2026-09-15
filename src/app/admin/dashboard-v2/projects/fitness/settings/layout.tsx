import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personal Fitness Settings",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
