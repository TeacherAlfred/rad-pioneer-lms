import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server'; // Swapped to the secure server client

// Your specific Admin UUID
const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';

export default async function PrivateProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize the server-side client to read cookies
  const supabase = await createClient();

  // 1. Check if there is an active user session securely on the server
  const { data: { user } } = await supabase.auth.getUser();

  // 2. If no user, or the logged-in user is NOT you, kick them out
  if (!user || user.id !== MY_ADMIN_ID) {
    redirect('/login'); 
  }

  // 3. If it is you, render the private project
  return (
    <div className="private-project-wrapper">
      {/* Optional: You could add a tiny "Admin Mode" badge here that floats on all private projects */}
      {children}
    </div>
  );
}