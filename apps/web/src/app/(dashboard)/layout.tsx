export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(168,85,247,0.07)_0%,transparent_60%),radial-gradient(ellipse_60%_50%_at_90%_100%,rgba(147,51,234,0.05)_0%,transparent_60%)]">
      {children}
    </div>
  );
}
