import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentVocabDashJoinPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const params = await searchParams;
  redirect(`/play${params.code ? `?code=${encodeURIComponent(params.code)}` : ""}`);
}
