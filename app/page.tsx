/**
 * ============================================================================
 * ROOT REDIRECT PAGE
 * ============================================================================
 * 
 * Titik masuk root (/) aplikasi ERP yang mengarahkan langsung pengguna ke rute
 * /dashboard. Pengguna yang belum terotentikasi akan dicegat dan diarahkan ke /login
 * oleh sistem middleware.
 * ============================================================================
 */

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
