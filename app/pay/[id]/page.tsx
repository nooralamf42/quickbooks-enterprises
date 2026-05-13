import { redirect } from 'next/navigation';

export default async function PayRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Automatically redirect to the login flow (Step 1) to prevent UI flicker
  redirect(`/login?payment=${id}`);
}
