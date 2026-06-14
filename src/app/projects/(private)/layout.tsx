import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Your specific Admin UUID
const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';

export default async function PrivateProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Check if there is an active session
  const { data: { session } } = await supabase.auth.getSession();

  // 2. If no session, or the logged-in user is NOT you, kick them out
  if (!session || session.user.id !== MY_ADMIN_ID) {
    redirect('/login'); // Redirect unauthorized users to login (or a 404 page)
  }

  // 3. If it is you, render the private project
  return (
    <div className="private-project-wrapper">
      {/* Optional: You could add a tiny "Admin Mode" badge here that floats on all private projects */}
      {children}
    </div>
  );
}