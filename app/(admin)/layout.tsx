import { AppSidebar } from "@/components/app-sidebar";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { admin } = await requireAdmin();

  return (
    <div className="min-h-screen md:flex">
      <AppSidebar adminName={admin.name} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
