import { PublicChangelogPage } from "@/components/changelog/public-pages";

export const metadata = { title: "Changelog" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicChangelogPage slug={slug} />;
}
