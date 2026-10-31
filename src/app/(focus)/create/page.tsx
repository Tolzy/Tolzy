import type { Metadata } from "next";
import { CreatePortrait } from "@/components/create/create-portrait";

export const metadata: Metadata = { title: "New portrait" };

export default function CreatePage() {
  return <CreatePortrait />;
}
