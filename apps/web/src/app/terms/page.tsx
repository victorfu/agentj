import Link from 'next/link';
import {
  Network,
  Info,
  XCircle,
  Lock,
  KeyRound,
  Trash2
} from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 bg-background/80 backdrop-blur-xl shadow-[0_10px_15px_-3px_rgba(6,198,86,0.1)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Network className="size-5 text-primary" />
            <span className="text-xl font-black tracking-tighter text-primary uppercase">AgentJ</span>
          </Link>
        </div>
        <div className="bg-primary/10 h-[1px] w-full" />
      </nav>

      <main className="pt-8 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar */}
        <aside className="lg:col-span-3 hidden lg:block sticky top-16 h-fit">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-widest text-primary/50 mb-4 uppercase">
              Navigation
            </p>
            <a
              className="block py-2 px-3 text-sm font-medium text-primary bg-primary/10 rounded-sm border-l-2 border-primary"
              href="#acceptance"
            >
              Acceptance of Terms
            </a>
            <a
              className="block py-2 px-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
              href="#description"
            >
              Service Description
            </a>
            <a
              className="block py-2 px-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
              href="#obligations"
            >
              User Obligations
            </a>
            <a
              className="block py-2 px-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
              href="#security"
            >
              Data &amp; Security
            </a>
            <a
              className="block py-2 px-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
              href="#liability"
            >
              Limitation of Liability
            </a>
          </div>

          <div className="mt-12 p-4 bg-primary/5 border border-primary/10 rounded-lg">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Info className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Legal Notice</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Last Updated: <span className="text-foreground">October 24, 2024</span>. Updates are
              broadcasted via our webhook status channel.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-16">
          {/* Hero Header */}
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">
                Version 2.4.0-STABLE
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-none">
              Terms of <span className="text-primary">Service</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
              By accessing the AgentJ Webhook Infrastructure, you agree to nourish the ecosystem and
              adhere to our synthetic photosynthesis protocols.
            </p>
          </header>

          <div className="space-y-24">
            {/* 01 Acceptance */}
            <section className="scroll-mt-32 group" id="acceptance">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-primary/20 font-black text-4xl tabular-nums">01</span>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Acceptance of Terms
                </h2>
              </div>
              <div className="bg-card border border-primary/5 p-8 rounded-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
                <p className="text-muted-foreground leading-relaxed">
                  By creating an account, accessing, or using the AgentJ platform, you
                  (&quot;User&quot; or &quot;Subscriber&quot;) acknowledge that you have read,
                  understood, and agree to be bound by these Terms of Service. If you are entering
                  into this agreement on behalf of a company, you represent that you have the legal
                  authority to bind that entity.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Failure to comply with these terms may result in the immediate metabolic
                  termination of your API keys and stored webhook configurations.
                </p>
              </div>
            </section>

            {/* 02 Service Description */}
            <section className="scroll-mt-32 group" id="description">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-primary/20 font-black text-4xl tabular-nums">02</span>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Service Description
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-accent/40 border border-border rounded-lg">
                  <Network className="size-6 text-primary mb-4" />
                  <h3 className="font-bold text-foreground mb-2">Synthetic Dispatch</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time webhook routing and fan-out services with sub-50ms latency across
                    global clusters.
                  </p>
                </div>
                <div className="p-6 bg-accent/40 border border-border rounded-lg">
                  <Network className="size-6 text-primary mb-4" />
                  <h3 className="font-bold text-foreground mb-2">Metabolic Logs</h3>
                  <p className="text-sm text-muted-foreground">
                    Full observability into payload delivery, retry logic, and endpoint health
                    monitoring.
                  </p>
                </div>
              </div>
            </section>

            {/* 03 User Obligations */}
            <section className="scroll-mt-32 group" id="obligations">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-primary/20 font-black text-4xl tabular-nums">03</span>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  User Obligations
                </h2>
              </div>
              <div className="bg-muted border-l-4 border-primary p-8 rounded-r-xl">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4">
                  Zero-Tolerance Bot Policy
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  AgentJ is designed for legitimate application integration. Users are strictly
                  prohibited from utilizing the service for:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <XCircle className="size-[18px] text-destructive shrink-0 mt-0.5" />
                    Illegal automated activity or DDoS orchestration.
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <XCircle className="size-[18px] text-destructive shrink-0 mt-0.5" />
                    Spamming non-consenting endpoints or social engineering.
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <XCircle className="size-[18px] text-destructive shrink-0 mt-0.5" />
                    Circumventing security measures of third-party platforms.
                  </li>
                </ul>
              </div>
            </section>

            {/* 04 Data Usage & Security */}
            <section className="scroll-mt-32 group" id="security">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-primary/20 font-black text-4xl tabular-nums">04</span>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Data Usage &amp; Webhook Security
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                <div className="bg-accent p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Lock className="size-5 text-primary" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Encryption</h4>
                  <p className="text-[11px] text-muted-foreground">
                    All payloads are encrypted at rest with AES-256 and via TLS 1.3 in transit.
                  </p>
                </div>
                <div className="bg-accent p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <KeyRound className="size-5 text-primary" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Signing</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Mandatory HMAC signatures on all outgoing dispatches for source verification.
                  </p>
                </div>
                <div className="bg-accent p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Trash2 className="size-5 text-primary" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Purge Logic</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Temporary payload storage is automatically flushed every 72 hours.
                  </p>
                </div>
              </div>
            </section>

            {/* 05 Limitation of Liability */}
            <section className="scroll-mt-32 group" id="liability">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-primary/20 font-black text-4xl tabular-nums">05</span>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Limitation of Liability
                </h2>
              </div>
              <div className="max-w-none text-muted-foreground text-sm leading-relaxed space-y-4">
                <p>
                  AgentJ provides its services on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;
                  basis. To the maximum extent permitted by law, we shall not be liable for any
                  indirect, incidental, special, or consequential damages resulting from the use or
                  inability to use the service.
                </p>
                <p>
                  Our total liability for any claim arising from these terms shall not exceed the
                  amount paid by you to AgentJ in the twelve (12) months preceding the event giving
                  rise to the claim. We do not guarantee 100% &quot;photosynthetic&quot; uptime
                  during solar flares or core infrastructure maintenance.
                </p>
              </div>
            </section>
          </div>

          {/* Bottom CTA */}
          <div className="p-10 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Have questions about our terms?
              </h3>
              <p className="text-muted-foreground text-sm">
                Reach out to our legal engineering department for clarification.
              </p>
            </div>
            <button className="whitespace-nowrap bg-primary/10 text-primary border border-primary/20 px-8 py-3 rounded-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95">
              Contact Legal
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
