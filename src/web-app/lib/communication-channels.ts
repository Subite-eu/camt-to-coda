import definitions from "../../../examples/bank-catalog/channel-definitions.json";

export { definitions };
export type Market = { region: string; country: string };
export type CommunicationChannel = {
  kind: keyof typeof definitions.kinds; label: string;
  automation: keyof typeof definitions.automation;
  availability: keyof typeof definitions.availability;
  payload: keyof typeof definitions.payload;
  formats: string[]; markets: Market[]; scope: string; setup: string; timing?: string;
  sources: { label: string; url: string }[]; verifiedOn: string;
};
export type ChannelInstitution = {
  id: string; title: string; institutionType: "bank" | "reference"; markets: Market[];
  communicationChannels?: CommunicationChannel[];
};
export type ChannelRow = { institution: ChannelInstitution; channel: CommunicationChannel };
export type ChannelFilters = { query: string; region: string; country: string; kind: string; automation: string; payload: string };
export function channelRows(institutions: ChannelInstitution[]): ChannelRow[] {
  return institutions.flatMap(institution => (institution.communicationChannels ?? []).map(channel => ({ institution, channel })));
}
export function matchesMarket(channel: CommunicationChannel, region: string, country: string): boolean {
  return channel.markets.some(m => (!region || m.region === region) && (!country || m.country === country));
}
export function filterChannelRows(rows: ChannelRow[], filters: ChannelFilters): ChannelRow[] {
  const words = filters.query.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(({ institution, channel: c }) => {
    const text = [institution.title, c.label, definitions.kinds[c.kind], ...c.formats, ...c.markets.map(m => m.country), c.scope, c.setup].join(" ").normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    return words.every(w => text.includes(w)) && matchesMarket(c, filters.region, filters.country)
      && (!filters.kind || c.kind === filters.kind) && (!filters.payload || c.payload === filters.payload)
      && (!filters.automation || (filters.automation === "possible"
        ? c.availability === "documented" && ["automated", "optional"].includes(c.automation)
        : c.automation === filters.automation));
  });
}
export function regionalChannelSummary(institutions: ChannelInstitution[]) {
  const rows = channelRows(institutions);
  return [...new Set(institutions.flatMap(e => e.markets.map(m => m.region)))].sort().map(region => {
    const scoped = rows.filter(({ channel }) => matchesMarket(channel, region, ""));
    const key = ({ institution }: ChannelRow) => `${institution.institutionType}:${institution.id}`;
    return {
      region, institutions: new Set(scoped.map(key)).size,
      automatedFiles: new Set(scoped.filter(({ channel: c }) => c.payload === "reporting-files"
        && c.availability === "documented" && ["automated", "optional"].includes(c.automation)).map(key)).size,
      kinds: [...new Set(scoped.map(({ channel }) => channel.kind))].sort(),
    };
  });
}
