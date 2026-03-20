import Link from 'next/link';
import {
  Network,
  Database,
  Settings2,
  Clock,
  Puzzle,
  ShieldCheck,
  Download
} from 'lucide-react';

export default function PrivacyPage() {
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

      <main className="pt-8 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
        {/* Sidebar */}
        <aside className="md:col-span-3 sticky top-16 self-start hidden md:block">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-widest text-primary/40 uppercase mb-4">
              Documentation
            </p>
            <nav className="flex flex-col gap-1">
              <a
                className="group flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-primary bg-primary/10 border-l-2 border-primary"
                href="#collection"
              >
                <Database className="size-[18px]" />
                Information Collection
              </a>
              <a
                className="group flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-primary/5 transition-all"
                href="#usage"
              >
                <Settings2 className="size-[18px]" />
                Data Processing
              </a>
              <a
                className="group flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-primary/5 transition-all"
                href="#retention"
              >
                <Clock className="size-[18px]" />
                Retention Policy
              </a>
              <a
                className="group flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-primary/5 transition-all"
                href="#integrations"
              >
                <Puzzle className="size-[18px]" />
                Third-Party Services
              </a>
              <a
                className="group flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-primary/5 transition-all"
                href="#rights"
              >
                <ShieldCheck className="size-[18px]" />
                User Rights
              </a>
            </nav>
          </div>

          <div className="mt-12 p-4 bg-accent rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                System Secure
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Compliance status: SOC2-ready. All data encrypted in transit (TLS 1.3).
            </p>
            <button className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary font-bold text-[11px] uppercase tracking-wider hover:bg-primary/20 transition-all">
              <Download className="size-4" />
              Download PDF
            </button>
          </div>
        </aside>

        {/* Content */}
        <article className="md:col-span-9 space-y-16">
          {/* Hero */}
          <section className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">
              Legal Protocol v4.0.2
            </div>
            <h1 className="text-[40px] font-black tracking-tighter leading-none text-foreground">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground text-[16px] max-w-2xl leading-relaxed">
              AgentJ is built on a foundation of cryptographic transparency. This document outlines
              how we ingest, route, and store data in our synthetic photosynthesis engine. Last
              updated: <span className="text-primary">October 24, 2024</span>.
            </p>
          </section>

          {/* 1. Information Collection */}
          <section className="space-y-6" id="collection">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-border">
                <Database className="size-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">1. Information Collection</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-card border border-border rounded-xl">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">
                  Identity
                </p>
                <p className="text-[14px] font-medium text-foreground">User IDs &amp; Email</p>
                <p className="text-[12px] text-muted-foreground mt-2 leading-tight">
                  Stored for account authentication and critical system alerts.
                </p>
              </div>
              <div className="p-4 bg-card border border-border rounded-xl">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">
                  Inbound
                </p>
                <p className="text-[14px] font-medium text-foreground">Webhook Payloads</p>
                <p className="text-[12px] text-muted-foreground mt-2 leading-tight">
                  Raw JSON/XML data received from external event triggers.
                </p>
              </div>
              <div className="p-4 bg-card border border-border rounded-xl">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">
                  System
                </p>
                <p className="text-[14px] font-medium text-foreground">Telemetry Data</p>
                <p className="text-[12px] text-muted-foreground mt-2 leading-tight">
                  IP addresses and browser headers for security auditing.
                </p>
              </div>
            </div>
          </section>

          {/* 2. How We Use Data */}
          <section className="space-y-6" id="usage">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-border">
                <Settings2 className="size-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">2. How We Use Data</h2>
            </div>
            <div className="space-y-4 text-muted-foreground text-[14px] leading-relaxed">
              <p>
                Our processing engine utilizes your data strictly for the technical execution of your
                defined workflows:
              </p>
              <ul className="space-y-3">
                <li className="flex gap-4">
                  <span className="text-primary font-bold">01</span>
                  <span>
                    <strong className="text-foreground">Routing &amp; Transformation:</strong> We
                    parse inbound payloads to route data between configured nodes and execute
                    user-defined logic.
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="text-primary font-bold">02</span>
                  <span>
                    <strong className="text-foreground">Logging &amp; Observability:</strong> We
                    generate execution logs to allow developers to debug failing endpoints and
                    monitor throughput.
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="text-primary font-bold">03</span>
                  <span>
                    <strong className="text-foreground">Proactive Debugging:</strong> Automated
                    systems may analyze error patterns to optimize node performance and suggest
                    configuration fixes.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* 3. Data Retention Policy */}
          <section className="space-y-6" id="retention">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-border">
                <Clock className="size-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">3. Data Retention Policy</h2>
            </div>
            <div className="bg-muted border border-border p-6 rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] font-black uppercase tracking-widest text-primary/60">
                    <th className="pb-4">Data Type</th>
                    <th className="pb-4">Retention Period</th>
                    <th className="pb-4">Storage Logic</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] divide-y divide-border">
                  <tr>
                    <td className="py-4 text-foreground font-medium">Activity Logs</td>
                    <td className="py-4">14 Days</td>
                    <td className="py-4 text-muted-foreground">Encrypted Hot Storage</td>
                  </tr>
                  <tr>
                    <td className="py-4 text-foreground font-medium">Webhook Payloads</td>
                    <td className="py-4">7 Days</td>
                    <td className="py-4 text-muted-foreground">Ephemeral Cache</td>
                  </tr>
                  <tr>
                    <td className="py-4 text-foreground font-medium">User Profile</td>
                    <td className="py-4">Account Duration</td>
                    <td className="py-4 text-muted-foreground">Persistent Vault</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Third-Party Integrations */}
          <section className="space-y-6" id="integrations">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-border">
                <Puzzle className="size-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">4. Third-Party Integrations</h2>
            </div>
            <p className="text-muted-foreground text-[14px]">
              AgentJ facilitates data flow to third-party APIs. Specifically, for our{' '}
              <strong className="text-foreground">LINE Messaging Integration</strong>, we transmit
              only the necessary notification payload as defined in your workflow schema. We do not
              sell or trade your data to third parties.
            </p>
            <div className="p-6 bg-primary/5 rounded-xl border-l-4 border-primary">
              <p className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                Technical Limitation
              </p>
              <p className="text-[13px] text-muted-foreground italic">
                Once data is transmitted to an external service (e.g., AWS, LINE, Slack), it becomes
                subject to that provider&apos;s privacy policy. AgentJ maintains no control over
                data once it leaves our synthetic biosphere.
              </p>
            </div>
          </section>

          {/* 5. User Rights */}
          <section className="space-y-6" id="rights">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-border">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">5. User Rights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-[14px] font-bold text-foreground">Access &amp; Export</h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Request a full JSON dump of all telemetry and profile data associated with your
                  User ID at any time via the console.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[14px] font-bold text-foreground">Right to Deletion</h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Closing your account triggers an immediate scrub of all persistent storage
                  clusters within 24 hours.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[14px] font-bold text-foreground">Processing Opt-out</h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Disable specific webhook endpoints to stop data collection for specific projects
                  without terminating your account.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[14px] font-bold text-foreground">Security Reporting</h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Report suspected vulnerabilities or data leakage directly to our security response
                  team for immediate investigation.
                </p>
              </div>
            </div>
          </section>

          {/* Contact footer */}
          <div className="pt-12 border-t border-border">
            <p className="text-[12px] text-muted-foreground">
              Questions regarding our privacy stack? Reach out to{' '}
              <a className="text-primary hover:underline" href="#">
                security@agentj.dev
              </a>
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
