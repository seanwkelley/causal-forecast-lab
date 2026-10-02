import type { Metadata } from "next";

export const metadata: Metadata = { title: "Run your own question" };

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
