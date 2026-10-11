import { expect, it } from "vitest";
import { channelRows, filterChannelRows, regionalChannelSummary, type ChannelInstitution, type CommunicationChannel, type ChannelFilters } from "./communication-channels";

const europe = { region: "Europe", country: "Belgium" };
const america = { region: "North America", country: "Canada" };
const base: CommunicationChannel = { kind: "sftp", label: "Reporting feed", automation: "automated", availability: "documented",
  formats: ["camt.053"], payload: "reporting-files", markets: [europe], scope: "Corporate accounts", setup: "Enrolment required",
  sources: [{ label: "Service guide", url: "https://example.com/guide" }], verifiedOn: "2026-10-11" };
const institutions: ChannelInstitution[] = [
  { id: "one", title: "One Bank", institutionType: "bank", markets: [europe, america], communicationChannels: [base, { ...base, kind: "ebics", label: "EBICS feed" }] },
  { id: "two", title: "Two Bank", institutionType: "bank", markets: [europe], communicationChannels: [{ ...base, kind: "api", payload: "account-data", formats: ["JSON"] }] },
  { id: "three", title: "Three Bank", institutionType: "bank", markets: [europe], communicationChannels: [{ ...base, availability: "announced" }] },
  { id: "four", title: "Four Bank", institutionType: "bank", markets: [europe], communicationChannels: [{ ...base, availability: "historical" }] },
  { id: "one", title: "Operator", institutionType: "reference", markets: [europe], communicationChannels: [{ ...base, payload: "infrastructure" }] },
  { id: "absent", title: "No Evidence Bank", institutionType: "bank", markets: [america] },
];
const empty: ChannelFilters = { query: "", region: "", country: "", kind: "", automation: "", payload: "" };
it("counts institutions once and keeps JSON APIs, announcements and operators out of automated-file coverage", () => {
  expect(regionalChannelSummary(institutions)).toEqual([
    { region: "Europe", institutions: 5, automatedFiles: 1, kinds: ["api", "ebics", "sftp"] },
    { region: "North America", institutions: 0, automatedFiles: 0, kinds: [] },
  ]);
});
it("filters channel scope rather than inheriting the parent bank's markets", () => {
  expect(filterChannelRows(channelRows(institutions), { ...empty, region: "North America" })).toEqual([]);
  expect(filterChannelRows(channelRows(institutions), { ...empty, country: "Canada" })).toEqual([]);
});
it("current automation includes other data APIs only when the content filter allows them", () => {
  const rows = channelRows(institutions);
  expect(filterChannelRows(rows, { ...empty, automation: "possible" })).toHaveLength(4);
  expect(filterChannelRows(rows, { ...empty, automation: "possible", payload: "reporting-files" })).toHaveLength(2);
  expect(filterChannelRows(rows, { ...empty, kind: "api", payload: "reporting-files" })).toEqual([]);
  expect(filterChannelRows(rows, { ...empty, kind: "api", payload: "account-data" })).toHaveLength(1);
});
it("searches bank names, formats and setup, and supports manual/unknown automation", () => {
  const rows = channelRows([{ ...institutions[0], title: "Banqué", communicationChannels: [
    { ...base, automation: "manual", kind: "banking-portal" }, { ...base, automation: "not-established" },
  ] }]);
  expect(filterChannelRows(rows, { ...empty, query: "banque enrolment camt.053", automation: "manual" })).toHaveLength(1);
  expect(filterChannelRows(rows, { ...empty, automation: "not-established" })).toHaveLength(1);
  expect(filterChannelRows(rows, { ...empty, automation: "possible" })).toEqual([]);
});
