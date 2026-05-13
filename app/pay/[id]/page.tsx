import { redirect } from 'next/navigation';

export default function PayRoute({ params }: { params: { id: string } }) {
  // Automatically redirect to the login flow (Step 1) to prevent UI flicker
  redirect(`/login?payment=${params.id}`);
}
