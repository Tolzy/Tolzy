import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentGallery } from "./gallery";

export const metadata: Metadata = { title: "Components", robots: { index: false } };

/** Development-only reference of every design-system component and state. */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ComponentGallery />;
}
