import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** Second line of defence behind proxy.ts: private pages always need a valid session. */
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.error) redirect("/login");
  return <>{children}</>;
}
