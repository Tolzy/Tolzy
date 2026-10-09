import { ReleaseEditorView } from "@/components/views/release-editor";

export const metadata = { title: "Edit release" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReleaseEditorView id={id} />;
}
