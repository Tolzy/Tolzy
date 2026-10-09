import { PublicReleasePage } from "@/components/changelog/public-pages";

export const metadata = { title: "Changelog" };

export default async function Page({ params }: { params: Promise<{ slug: string; releaseSlug: string }> }) {
  const { slug, releaseSlug } = await params;
  return <PublicReleasePage slug={slug} releaseSlug={releaseSlug} />;
}
