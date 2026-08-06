import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp, computePropertyMetrics } from "@/lib/store";
import { KpiCard } from "@/components/atoms";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarPlus, Flame, Building2, Zap, Sun, TrendingUp, Sparkles, IndianRupee, Brain, Radio, Activity } from "lucide-react";
import { useMemo } from "react";
import { useMountedNow } from "@/hooks/use-now";
import { buildDoNextQueue, liveConfidence, intentFor } from "@/lib/engine";
import { scanRevivals } from "@/lib/revival";
import { QuickActionRow } from "@/components/QuickActionRow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gharpayy" },
      { name: "description", content: "Live command center: leads, tours, follow-ups, deal probability and inventory pressure." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { leads, tours, followUps, properties, role, currentTcmId, selectLead, bookings, handoffs } = useApp();
  const [now, mounted] = useMountedNow();

  const filterTcm = role === "tcm" ? currentTcmId : undefined;
  const metrics = useMemo(() => computePropertyMetrics(properties, leads, tours), [properties, leads, tours]);
  const queue = useMemo(
    () => buildDoNextQueue(leads, tours, followUps, now, filterTcm),
    [leads, tours, followUps, now, filterTcm],
  );
  const revivals = useMemo(
    () => scanRevivals(leads, properties, tours, now),
    [leads, properties, tours, now],
  );

  // Live, decayed view of every lead
  const liveLeads = useMemo(
    () => leads.map((l) => ({ ...l, confidence: liveConfidence(l, tours, now), intent: intentFor(liveConfidence(l, tours, now)) })),
    [leads, tours, now],
  );
  const hotLeads = liveLeads.filter((l) => l.intent === "hot" && l.stage !== "booked" && l.stage !== "dropped");
  const incompleteTours = tours.filter((t) => t.status === "completed" && !t.postTour.filledAt);
  const todayTours = tours.filter((t) => t.status === "scheduled" && sameDay(+new Date(t.scheduledAt), now));
  const booked = tours.filter((t) => t.decision === "booked").length;
  const conversion = tours.length ? Math.round((booked / tours.length) * 100) : 0;
  const overdueFu = followUps.filter((f) => !f.done && +new Date(f.dueAt) < now).length;
  const monthlyRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const unreadHandoffs = handoffs.filter((h) => !h.read && h.to === role).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Arena Infrastructure</h1>
            <p className="text-sm text-muted-foreground">
              Every lead, every tour, every follow-up — one operating layer. <span className="text-accent font-mono">live</span>
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono min-h-[1em]">
            {mounted ? format(new Date(now), "EEEE, MMM d · h:mm a") : "\u00a0"}
          </div>
        </header>

        {unreadHandoffs > 0 && (
          <Link to="/handoffs" className="block rounded-xl border border-info/30 bg-info/5 p-3 hover:bg-info/10 transition-colors">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-info" />
              <div className="flex-1 text-sm">
                <span className="font-semibold">{unreadHandoffs} unread handoff{unreadHandoffs > 1 ? "s" : ""}</span>
                <span className="text-muted-foreground"> from {role === "tcm" ? "Flow Ops" : "TCM team"}</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-info" />
            </div>
          </Link>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Active leads" value={liveLeads.filter((l) => l.stage !== "booked" && l.stage !== "dropped").length} sub={`${hotLeads.length} hot · live score`} />
          <KpiCard label="Today's tours" value={todayTours.length} sub="Scheduled" tone="accent" />
          <KpiCard label="Overdue follow-ups" value={overdueFu} sub={`${incompleteTours.length} post-tour pending`} tone={overdueFu || incompleteTours.length ? "destructive" : "default"} />
          <KpiCard label="Conversion rate" value={`${conversion}%`} sub={`${booked} booked total`} tone="success" />
          <KpiCard label="MRR closed" value={`₹${(monthlyRevenue / 1000).toFixed(0)}k`} sub={`${bookings.length} booking${bookings.length === 1 ? "" : "s"}`} tone="success" />
        </div>

        {/* Today's queue (top 5 quick view) */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-semibold">Do this next</h2>
              <span className="text-[10px] text-muted-foreground font-mono">{queue.length} ranked</span>
            </div>
            <Link to="/today" className="text-xs text-accent inline-flex items-center gap-1">
              <Sun className="h-3 w-3" /> Today view <ArrowUpRight className="h-3 w-3" />
            </Link>
          </header>
          {queue.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Inbox zero. Nothing pending right now.</div>
          ) : (
            <div className="divide-y divide-border">
              {queue.slice(0, 5).map((a) => {
                const lead = leads.find((l) => l.id === a.leadId);
                if (!lead) return null;
                return (
                  <QuickActionRow
                    key={`${a.leadId}-${a.kind}`}
                    lead={lead}
                    reason={a.reason}
                    accent={a.kind === "post-tour-overdue" || a.kind === "first-response" || a.kind === "follow-up-overdue" ? "destructive" : a.kind === "no-follow-up" ? "warning" : "accent"}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Post-tour enforcement banner */}
        {incompleteTours.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <div className="font-semibold text-destructive text-sm">
                {incompleteTours.length} post-tour update{incompleteTours.length > 1 ? "s" : ""} missing
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Auto-escalation triggers at 6h. Click any name to fill the form now.
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {incompleteTours.map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId);
                  if (!lead) return null;
                  const hrs = Math.round((now - +new Date(t.scheduledAt)) / 36e5);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectLead(lead.id)}
                      className="text-[11px] rounded-md border border-destructive/30 bg-card px-2 py-0.5 hover:bg-destructive/10 transition-colors inline-flex items-center gap-1"
                    >
                      {lead.name} <span className="font-mono text-destructive min-w-[2ch] inline-block text-right">{mounted ? `${hrs}h` : '…'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hot pipeline */}
          <Card title="Hot pipeline" icon={Flame} accent action={<Link to="/leads" className="text-xs text-accent inline-flex items-center gap-1">All leads <ArrowUpRight className="h-3 w-3" /></Link>}>
            <div className="divide-y divide-border -mx-3">
              {hotLeads.slice(0, 5).map((l) => (
                <QuickActionRow key={l.id} lead={l} accent="accent" />
              ))}
              {hotLeads.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No hot leads right now.</div>}
            </div>
          </Card>

          {/* Today's tours */}
          <Card title="Today's tours" icon={CalendarPlus} action={<Link to="/tours" className="text-xs text-accent inline-flex items-center gap-1">All tours <ArrowUpRight className="h-3 w-3" /></Link>}>
            <div className="space-y-2">
              {todayTours.map((t) => {
                const lead = leads.find((l) => l.id === t.leadId);
                const prop = properties.find((p) => p.id === t.propertyId);
                if (!lead) return null;
                const minsTo = (+new Date(t.scheduledAt) - now) / 60_000;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectLead(lead.id)}
                    className="w-full text-left rounded-lg border border-border bg-card hover:border-accent/40 transition-colors p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{lead.name}</span>
                      <span className={`text-xs font-mono ${mounted && minsTo < 60 && minsTo > 0 ? "text-accent" : "text-muted-foreground"}`}>
                        {mounted ? (minsTo > 0 ? `in ${formatMins(minsTo)}` : `${formatMins(-minsTo)} ago`) : "\u00a0"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{prop?.name} · {format(new Date(t.scheduledAt), "p")}</div>
                  </button>
                );
              })}
              {todayTours.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No tours scheduled today.</div>}
            </div>
          </Card>
        </div>

        {/* Revival opportunities */}
        {revivals.length > 0 && (
          <section className="rounded-xl border border-info/30 bg-info/5 overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-info/20">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-info" />
                <h2 className="font-display text-sm font-semibold">Hidden revenue · revival queue</h2>
                <span className="text-[10px] text-muted-foreground font-mono">{revivals.length} candidate{revivals.length === 1 ? "" : "s"}</span>
              </div>
              <Link to="/revival" className="text-xs text-info inline-flex items-center gap-1">
                Open queue <ArrowUpRight className="h-3 w-3" />
              </Link>
            </header>
            <div className="divide-y divide-info/10">
              {revivals.slice(0, 4).map((r) => {
                const lead = leads.find((l) => l.id === r.leadId);
                if (!lead) return null;
                return (
                  <button
                    key={r.leadId}
                    onClick={() => selectLead(lead.id)}
                    className="w-full text-left px-4 py-2 hover:bg-info/5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{lead.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.reason}</div>
                    </div>
                    <span className="text-[10px] font-mono text-info shrink-0">score {r.score}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Why Gharpayy — Feature highlights */}
        <WhyGharpayy />

        {/* Inventory pressure */}
        <Card title="Inventory pressure" icon={Building2} action={<Link to="/inventory" className="text-xs text-accent inline-flex items-center gap-1">All properties <ArrowUpRight className="h-3 w-3" /></Link>}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.slice(0, 6).map((m) => (
              <div key={m.property.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm leading-tight">{m.property.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.property.area}</div>
                  </div>
                  <SignalChip signal={m.signal} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="Demand" value={m.demandScore} />
                  <Stat label="Conv %" value={m.conversionPct} />
                  <Stat label="Vacant" value={`${m.property.vacantBeds}/${m.property.totalBeds}`} mono />
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${m.pressureScore}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Pressure {m.pressureScore}/100</span>
                  <span className="inline-flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> live</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

/* ─── Why Gharpayy — 3-Feature Section ─────────────────────────────────── */
const FEATURES = [
  {
    id: "live-lead-scoring",
    icon: Zap,
    badge: "Feature 01",
    title: "Live Lead Scoring",
    tagline: "Every lead has a heartbeat. We track it.",
    description:
      "Gharpayy's proprietary confidence-decay engine scores every lead in real time — factoring in recency, tour outcomes, follow-up gaps, and engagement velocity. Hot leads rise. Cold ones surface for revival. No stale CRM data, ever.",
    uniqueness: "Unlike static pipelines, scores decay automatically every minute — so your team always works the right lead at the right time, without manual triage.",
    stat: "78%",
    statLabel: "avg score accuracy vs. actual bookings",
    tone: "accent" as const,
    link: "/leads" as const,
    linkLabel: "Open Leads",
  },
  {
    id: "visit-war-room",
    icon: Radio,
    badge: "Feature 02",
    title: "Visit War Room",
    tagline: "Every tour. Live. Tracked. Enforced.",
    description:
      "The Visit War Room gives Flow Ops a live satellite view of every property tour happening across the city — check-in timestamps, TCM notes, post-tour form completion, and SLA breach alerts. Nothing slips through.",
    uniqueness: "Automated 6-hour escalation timers ensure post-tour forms are never skipped. The industry average is 40% missing — Gharpayy teams hit 95%+ completion.",
    stat: "95%",
    statLabel: "post-tour form completion rate",
    tone: "info" as const,
    link: "/visit-war" as const,
    linkLabel: "Open War Room",
  },
  {
    id: "ai-coach",
    icon: Brain,
    badge: "Feature 03",
    title: "AI Coach",
    tagline: "Your smartest team member. Always on.",
    description:
      "The Gharpayy AI Coach automatically spots stale leads, generates revival scripts, suggests next-best-actions, and runs engagement sequences — all without your team lifting a finger. It learns from your data, not generic playbooks.",
    uniqueness: "Revival sequences re-engage leads that went cold 7–30 days ago, recovering an average 12% additional bookings per month — revenue that would otherwise be permanently lost.",
    stat: "+12%",
    statLabel: "bookings recovered via AI revival",
    tone: "success" as const,
    link: "/coach" as const,
    linkLabel: "Open Coach",
  },
] as const;

type FeatureTone = "accent" | "info" | "success";

const TONE_MAP: Record<FeatureTone, { badge: string; stat: string; bar: string; border: string; bg: string; glow: string }> = {
  accent:  { badge: "bg-accent/10 text-accent border-accent/20",        stat: "text-accent",        bar: "bg-accent",       border: "border-accent/20",   bg: "bg-accent/5",   glow: "shadow-accent/10" },
  info:    { badge: "bg-info/10 text-info border-info/20",              stat: "text-info",          bar: "bg-info",         border: "border-info/20",     bg: "bg-info/5",     glow: "shadow-info/10" },
  success: { badge: "bg-success/10 text-success border-success/20",    stat: "text-success",      bar: "bg-success",     border: "border-success/20",  bg: "bg-success/5",  glow: "shadow-success/10" },
};

function WhyGharpayy() {
  return (
    <section className="space-y-4">
      {/* Section header */}
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block h-px w-8 bg-accent" />
            <span className="text-[10px] uppercase tracking-widest text-accent font-semibold font-mono">Why Gharpayy</span>
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Built different. Built for closers.</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Three unfair advantages powering your deal flow.</p>
        </div>
        <Activity className="h-5 w-5 text-muted-foreground/40" />
      </header>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const t = TONE_MAP[f.tone];
          return (
            <div
              key={f.id}
              className={`relative rounded-xl border ${t.border} ${t.bg} bg-card overflow-hidden flex flex-col shadow-sm hover:shadow-md ${t.glow} transition-all duration-300 group`}
            >
              {/* Top accent bar */}
              <div className={`h-0.5 w-full ${t.bar}`} />

              <div className="p-5 flex flex-col flex-1 gap-4">
                {/* Badge + icon row */}
                <div className="flex items-start justify-between">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${t.badge}`}>
                    {f.badge}
                  </span>
                  <div className={`h-9 w-9 rounded-lg ${t.bg} border ${t.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-4 w-4 ${t.stat}`} />
                  </div>
                </div>

                {/* Title + tagline */}
                <div>
                  <h3 className="font-display text-base font-semibold leading-tight">{f.title}</h3>
                  <p className={`text-xs font-medium mt-0.5 ${t.stat}`}>{f.tagline}</p>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.description}</p>

                {/* Uniqueness callout */}
                <div className={`rounded-lg border ${t.border} ${t.bg} p-3`}>
                  <div className="flex items-start gap-2">
                    <Sparkles className={`h-3.5 w-3.5 ${t.stat} shrink-0 mt-0.5`} />
                    <p className="text-[11px] text-muted-foreground leading-snug">{f.uniqueness}</p>
                  </div>
                </div>

                {/* Stat + CTA */}
                <div className="flex items-end justify-between mt-auto pt-1">
                  <div>
                    <div className={`font-display text-2xl font-bold tabular-nums ${t.stat}`}>{f.stat}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight max-w-[140px]">{f.statLabel}</div>
                  </div>
                  <Link
                    to={f.link}
                    className={`inline-flex items-center gap-1 text-xs font-medium ${t.stat} hover:underline underline-offset-2`}
                  >
                    {f.linkLabel} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Card({
  title, icon: Icon, action, accent, children,
}: {
  title: string; icon: typeof Flame; action?: React.ReactNode; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
          <h2 className="font-display text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function SignalChip({ signal }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"] }) {
  const map = {
    "high-demand-low-conv": { label: "Pricing issue", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    "low-demand-high-vacancy": { label: "Push marketing", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    "high-conv-low-supply": { label: "Expand", cls: "bg-success/10 text-success border-success/30" },
    "balanced": { label: "Balanced", cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const cfg = map[signal];
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function sameDay(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatMins(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(m < 600 ? 1 : 0)}h`;
}
