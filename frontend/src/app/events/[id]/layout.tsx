import AppShell from "@/components/AppShell";

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
