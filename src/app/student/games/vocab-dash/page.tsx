import { notFound, redirect } from "next/navigation";
import { gamesFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function StudentVocabDashJoinPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  if (!gamesFeatureEnabled()) notFound();
  const params = await searchParams;
  redirect(`/play${params.code ? `?code=${encodeURIComponent(params.code)}` : ""}`);
}
