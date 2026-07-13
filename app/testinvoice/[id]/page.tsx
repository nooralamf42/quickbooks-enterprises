import { redirect } from 'next/navigation';

export default async function TestPayRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Automatically redirect to the test login flow to prevent UI flicker
  redirect(`/test/auth?token=${id}`);
}
