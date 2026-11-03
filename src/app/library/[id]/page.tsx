import { redirect } from 'next/navigation';

export default async function OldStoryLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/story/${id}`);
}
