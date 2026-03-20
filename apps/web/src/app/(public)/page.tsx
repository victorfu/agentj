import Link from 'next/link';
import {
  Network,
  MonitorDot,
  Terminal,
  MessageCircle,
  Zap,
  Shield,
  CheckCircle2,
  Ban
} from 'lucide-react';

export default function HomePage() {
  return (
    <main
      className="min-h-screen"
      style={{
        backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundBlendMode: 'overlay'
      }}
    >
      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 bg-background/80 backdrop-blur-xl shadow-[0_10px_15px_-3px_rgba(6,198,86,0.1)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Network className="size-5 text-primary" />
            <span className="text-xl font-black tracking-tighter text-primary uppercase">AgentJ</span>
          </Link>
          <div className="hidden md:flex gap-8 items-center tracking-tight text-[14px] font-medium">
            <Link href="/docs" className="text-primary/60 hover:text-primary transition-colors">
              Docs
            </Link>
            <Link href="/terms" className="text-primary/60 hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-primary/60 hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>
          <Link
            href="/console"
            className="bg-primary text-primary-foreground px-5 py-2 font-bold text-[12px] uppercase tracking-wider hover:brightness-110 active:scale-95 duration-100 rounded-sm"
          >
            Console
          </Link>
        </div>
        <div className="bg-primary/10 h-[1px] w-full" />
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 lg:py-32 flex flex-col items-center text-center">
        <div className="mb-6 flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            v2.4 Synthetic-Engine Active
          </span>
        </div>
        <h1 className="font-extrabold text-4xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6 leading-[1.1]">
          Synthetic Photosynthesis <br />
          <span className="text-primary">for Webhooks</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground text-base md:text-lg mb-10 leading-relaxed">
          Instant development environment for LINE Bots with built-in ngrok-style tunneling.{' '}
          <br className="hidden md:block" />
          Deploy in one click. Feed your bot the data it craves.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="bg-primary text-primary-foreground px-8 py-4 font-bold text-[14px] uppercase tracking-widest shadow-[0_0_20px_rgba(6,198,86,0.3)] hover:shadow-[0_0_30px_rgba(6,198,86,0.5)] transition-all"
          >
            Start Building for Free
          </Link>
          <Link
            href="/docs"
            className="bg-primary/10 text-primary border border-primary/20 px-8 py-4 font-bold text-[14px] uppercase tracking-widest hover:bg-primary/20 transition-all"
          >
            View Technical Specs
          </Link>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Instant Tunneling — large */}
          <div className="md:col-span-2 bg-card border border-border p-8 relative overflow-hidden group">
            <div className="relative z-10">
              <Network className="size-9 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Instant Tunneling</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Expose local servers to the world securely. Our global mesh network ensures{' '}
                <span className="text-primary">sub-10ms latency</span> for every incoming LINE
                Messaging API payload.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 group-hover:opacity-20 transition-opacity">
              <Network className="size-[180px]" />
            </div>
          </div>

          {/* Real-time Inspector */}
          <div className="bg-card border border-border p-8 flex flex-col justify-between">
            <div>
              <MonitorDot className="size-9 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Real-time Inspector</h3>
              <p className="text-muted-foreground text-sm">
                Visualize every JSON payload with biological precision. Deep introspection for
                nested objects.
              </p>
            </div>
            <div className="mt-8 bg-muted p-4 rounded-sm font-mono text-[10px] text-primary/70">
              {'{ "type": "message", "source": { "userId": "U...656" } }'}
            </div>
          </div>

          {/* Web IDE */}
          <div className="bg-card border border-border p-8">
            <Terminal className="size-9 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">Web IDE</h3>
            <p className="text-muted-foreground text-sm">
              Code, test, and deploy without leaving the browser. Integrated monaco editor with LINE
              Bot SDK typings pre-installed.
            </p>
          </div>

          {/* LINE Integration — large */}
          <div className="md:col-span-2 bg-primary/5 border border-primary/20 p-8 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <MessageCircle className="size-9 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">LINE Integration</h3>
              <p className="text-muted-foreground text-sm">
                Pre-configured environments for Messaging API. One-click setup for Channel Secret
                and Access Tokens. No boilerplate, just production-ready hooks.
              </p>
            </div>
            <div className="w-full md:w-1/3 aspect-square bg-accent rounded-lg flex items-center justify-center border border-primary/10">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full" />
                <MessageCircle
                  className="size-16 text-primary relative"
                  style={{ fill: 'currentColor' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Synthesis Pipeline */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-y border-border bg-muted/50">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">The Synthesis Pipeline</h2>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">
            Encapsulated Data Flow Architecture
          </p>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-center gap-12 py-10 relative">
          {/* Node 1: LINE */}
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-20 h-20 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-[0_0_15px_rgba(6,198,86,0.2)]">
              <MessageCircle className="size-8 text-primary" />
            </div>
            <p className="text-[10px] font-bold tracking-widest uppercase">LINE Platform</p>
          </div>

          {/* Connector */}
          <div className="hidden lg:block flex-1 h-[2px] bg-gradient-to-r from-primary to-primary/10 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-primary/30 flex items-center justify-center bg-background">
              <Zap className="size-4 text-primary animate-pulse" />
            </div>
          </div>

          {/* Node 2: AgentJ Node */}
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-24 h-24 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(6,198,86,0.4)] rotate-45">
              <div className="-rotate-45 flex flex-col items-center">
                <Network className="size-8 text-primary-foreground" />
                <span className="text-[8px] font-black text-primary-foreground tracking-tighter uppercase mt-1">
                  AgentJ Node
                </span>
              </div>
            </div>
          </div>

          {/* Connector */}
          <div className="hidden lg:block flex-1 h-[2px] bg-gradient-to-r from-primary/10 to-primary relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-primary/30 flex items-center justify-center bg-background">
              <Shield className="size-4 text-primary animate-pulse" />
            </div>
          </div>

          {/* Node 3: Dev Workspace */}
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-20 h-20 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-[0_0_15px_rgba(6,198,86,0.2)]">
              <Terminal className="size-8 text-primary" />
            </div>
            <p className="text-[10px] font-bold tracking-widest uppercase">Developer Workspace</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-3xl font-extrabold mb-2">Nutrient Tiers</h2>
          <div className="h-1 w-20 bg-primary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free */}
          <div className="bg-card border border-border p-10 flex flex-col hover:bg-accent transition-all group">
            <div className="mb-8">
              <h3 className="text-xl font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                Free
              </h3>
              <div className="text-4xl font-black mt-2">
                $0 <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />1 Single-Use Tunnel
              </li>
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                100 Requests per Hour
              </li>
              <li className="flex items-center gap-3 text-sm opacity-50">
                <Ban className="size-4 shrink-0" />
                Custom Domains
              </li>
            </ul>
            <button className="w-full py-3 border border-primary/40 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/10 transition-all">
              Select Node
            </button>
          </div>

          {/* Pro */}
          <div className="bg-primary/5 border-2 border-primary p-10 flex flex-col relative overflow-hidden group">
            <div className="absolute top-4 right-4 bg-primary text-primary-foreground text-[8px] font-black px-2 py-1 uppercase tracking-tighter">
              Recommended
            </div>
            <div className="mb-8">
              <h3 className="text-xl font-bold uppercase tracking-widest text-primary">Pro</h3>
              <div className="text-4xl font-black mt-2">
                $29 <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                Unlimited Persistent Tunnels
              </li>
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                1M Requests per Day
              </li>
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                Custom Domains &amp; Wildcards
              </li>
              <li className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                Advanced Payload Logging
              </li>
            </ul>
            <button className="w-full py-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_15px_rgba(6,198,86,0.2)]">
              Activate Power
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-6 py-32 text-center">
        <div className="bg-card border border-border p-16 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">
              Scale from zero to billions of requests.
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
              Join 15,000+ developers building the future of LINE bots on the most reliable webhook
              infrastructure ever grown.
            </p>
            <Link
              href="/register"
              className="inline-block bg-primary text-primary-foreground px-12 py-5 font-bold text-[16px] uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(6,198,86,0.3)] hover:scale-105 transition-transform"
            >
              Establish Connection Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 px-6 border-t border-primary/10 bg-background">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="text-primary font-extrabold text-lg uppercase tracking-tighter">
              AgentJ
            </div>
            <p className="text-primary/40 text-[10px] uppercase font-bold tracking-widest">
              Synthetic Photosynthesis for Webhooks.
            </p>
          </div>
          <div className="flex gap-6 text-[12px] uppercase tracking-wider font-bold">
            <Link
              href="/privacy"
              className="text-primary/40 hover:text-primary hover:underline decoration-primary/50 transition-all duration-300"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-primary/40 hover:text-primary hover:underline decoration-primary/50 transition-all duration-300"
            >
              Terms
            </Link>
            <Link
              href="/docs"
              className="text-primary/40 hover:text-primary hover:underline decoration-primary/50 transition-all duration-300"
            >
              Docs
            </Link>
          </div>
          <div className="text-primary/40 text-[10px] font-bold uppercase">
            &copy; 2024 AgentJ.
          </div>
        </div>
      </footer>
    </main>
  );
}
