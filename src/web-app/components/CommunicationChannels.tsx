import { useState } from "react";
import { channelRows, definitions, filterChannelRows, matchesMarket, regionalChannelSummary, type ChannelInstitution, type CommunicationChannel } from "../lib/communication-channels";

const controlClass = "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm";
export function ChannelDetails({ channels, region = "", country = "" }: { channels: CommunicationChannel[]; region?: string; country?: string }) {
  const visible = channels.filter(c => matchesMarket(c, region, country));
  if (!visible.length) return null;
  return <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Customer delivery and automation ({visible.length})</summary>
    <ul className="divide-y">{visible.map((c, i) => <li key={`${c.kind}-${i}`} className="py-3 space-y-2">
      <p className="font-medium">{c.label} · {definitions.kinds[c.kind]}</p>
      <p>{definitions.automation[c.automation]} · {definitions.availability[c.availability]} · {definitions.payload[c.payload]}</p>
      <p>{c.formats.join(" · ")} · {c.markets.map(m => `${m.region} / ${m.country}`).join("; ")}</p>
      <p>{c.scope}</p><p><span className="font-medium">Setup / access: </span>{c.setup}</p>
      {c.timing && <p><span className="font-medium">Schedule: </span>{c.timing}</p>}
      <p className="text-muted-foreground">Channel evidence checked {c.verifiedOn}.</p>
      <ul>{c.sources.map((s, n) => <li key={`${s.url}-${n}`}><a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">{s.label} ↗</a></li>)}</ul>
    </li>)}</ul>
  </details>;
}

export function CommunicationChannels({ institutions }: { institutions: ChannelInstitution[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState("");
  const [automation, setAutomation] = useState("");
  const [payload, setPayload] = useState("");
  const rows = channelRows(institutions);
  const summary = regionalChannelSummary(institutions);
  const filtered = filterChannelRows(rows, { query, region, country, kind, automation, payload });
  const countries = [...new Set(rows.flatMap(({ channel: c }) => c.markets.filter(m => !region || m.region === region).map(m => m.country)))].sort();
  const groups = institutions.map(institution => ({ institution, channels: filtered.filter(r => r.institution === institution).map(r => r.channel) })).filter(g => g.channels.length);
  function reset() { setQuery(""); setRegion(""); setCountry(""); setKind(""); setAutomation(""); setPayload(""); }
  return <div className="space-y-6 min-w-0">
    <div className="space-y-3 max-w-3xl"><h2 className="text-xl font-semibold">Communication channels</h2>
      <p>Find how customers receive reporting files and where automated connections are documented. Each record states the format, market, setup and official source.</p>
      <p className="text-sm text-muted-foreground">Counts describe verified catalog coverage, not market share or universal bank availability. Missing information means not established. An API for other account data does not establish CAMT delivery; operator and interbank reporting has separate eligibility.</p>
    </div>
    <div role="region" aria-label="Regional channel overview" tabIndex={0} className="overflow-x-auto rounded-md border focus-visible:outline focus-visible:outline-ring">
      <table aria-label="Communication channels by region" className="w-full text-left text-sm">
        <caption className="p-3 text-left font-medium">Regional overview · all catalog evidence, independent of filters below</caption>
        <thead><tr className="border-b"><th scope="col" className="p-3">Region</th><th scope="col" className="p-3">Institutions with evidence</th><th scope="col" className="p-3">Automated file reporting</th><th scope="col" className="p-3">Channels documented</th></tr></thead>
        <tbody>{summary.map(s => <tr key={s.region} className="border-b last:border-0"><th scope="row" className="p-3"><button onClick={() => { setRegion(s.region); setCountry(""); }} className="min-h-11 underline underline-offset-4 whitespace-nowrap" aria-label={`Filter channels to ${s.region}`}>{s.region}</button></th><td className="p-3">{s.institutions}</td><td className="p-3">{s.automatedFiles}</td><td className="p-3">{s.kinds.map(k => definitions.kinds[k]).join(" · ") || "Not established"}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="text-sm text-muted-foreground max-w-3xl">Institutions are counted once per region. Automated file reporting counts documented CAMT/CODA file channels with automation available; it excludes other account-data APIs, operator-only infrastructure and announced or historical offerings. Multiple regions means the publisher has not identified individual markets.</p>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <label className="col-span-2 lg:col-span-1 space-y-1 text-sm">Search delivery information<input type="search" value={query} onChange={e => setQuery(e.target.value)} className={controlClass} placeholder="Bank, format, channel or setup" /></label>
      <label className="space-y-1 text-sm">Region<select aria-label="Region" value={region} onChange={e => { setRegion(e.target.value); setCountry(""); }} className={controlClass}><option value="">All regions</option>{summary.map(s => <option key={s.region}>{s.region}</option>)}</select></label>
      <label className="space-y-1 text-sm">Country / market<select aria-label="Country / market" value={country} onChange={e => setCountry(e.target.value)} className={controlClass}><option value="">All countries / markets</option>{countries.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="space-y-1 text-sm">Delivery channel<select aria-label="Delivery channel" value={kind} onChange={e => setKind(e.target.value)} className={controlClass}><option value="">All channels</option>{Object.entries(definitions.kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">Automation<select aria-label="Automation" value={automation} onChange={e => setAutomation(e.target.value)} className={controlClass}><option value="">All automation levels</option><option value="possible">Documented automation / M2M</option><option value="manual">Manual download</option><option value="not-established">Automation not established</option></select></label>
      <label className="space-y-1 text-sm">Delivered content<select aria-label="Delivered content" value={payload} onChange={e => setPayload(e.target.value)} className={controlClass}><option value="">All delivered content</option>{Object.entries(definitions.payload).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap gap-4 items-center text-sm"><p role="status">{filtered.length} of {rows.length} channel records · {groups.length} institutions</p><button className="min-h-11 underline underline-offset-4" onClick={reset}>Reset channel filters</button></div>
    {!groups.length && <p>No documented channels match these filters. Try another channel or region; absence is not evidence that a service is unavailable.</p>}
    <div className="space-y-4">{groups.map(({ institution: e, channels }) => <article aria-label={`${e.title} communication channels`} key={`${e.institutionType}:${e.id}`} className="rounded-lg border p-4 sm:p-5 space-y-3 break-words">
      <h3 className="text-lg font-semibold">{e.title}</h3><p className="text-sm text-muted-foreground">{e.institutionType === "reference" ? "Reference / operating institution" : "Bank / brand"}</p>
      <p className="text-sm">{channels.map(c => `${definitions.kinds[c.kind]} · ${definitions.automation[c.automation]}`).join("; ")}</p>
      <ChannelDetails channels={channels} />
    </article>)}</div>
  </div>;
}
