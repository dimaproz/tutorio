import { redirect } from 'next/navigation';

// The studio opens on its students until the rebuilt home screen lands.
export default function AppHomePage() {
  redirect('/app/students');
}
