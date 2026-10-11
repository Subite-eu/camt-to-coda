import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ExampleLibrary } from "./ExampleLibrary";
import { fetchExampleOriginal } from "../lib/publisher-download";
import { downloadBlob } from "../lib/download";

vi.mock("../lib/publisher-download", async importOriginal => ({ ...await importOriginal<typeof import("../lib/publisher-download")>(), fetchExampleOriginal: vi.fn() }));
vi.mock("../lib/download", () => ({ downloadBlob: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it("identifies Huntington as illustrative extracted inline XML and offers saved-page extraction", async () => {
  vi.mocked(fetchExampleOriginal).mockRejectedValue(new Error("CORS"));
  render(<ExampleLibrary initialBank="huntington" />);
  expect(screen.getAllByRole("article")).toHaveLength(2);
  const row = screen.getByRole("article", { name: "bank:huntington-052" });
  expect(within(row).getByText("Extracted inline XML")).toBeInTheDocument();
  expect(within(row).getByText("Published schema issue")).toBeInTheDocument();
  expect(within(row).getByLabelText(/Choose saved publisher Markdown/)).toBeInTheDocument();
  expect(within(row).getByRole("link", { name: "Publisher Markdown source ↗" })).toHaveAttribute("href", "https://developer.huntington.com/enterprisepayments/docs/camt052.md");
  await userEvent.click(within(row).getByRole("button", { name: "Save original file" }));
  expect(await within(row).findByRole("alert")).toHaveTextContent("Extract saved publisher page");
});

it("does not offer a dead usage-terms link where the source inventory has no verified URL", () => {
  render(<ExampleLibrary initialBank="seb" />);
  const row = screen.getAllByRole("article")[0];
  expect(within(row).queryByRole("link", { name: "Usage terms ↗", hidden: true })).not.toBeInTheDocument();
  expect(within(row).getByText(/No separate usage-terms link verified/)).toBeInTheDocument();
});

it("pages the whole catalog without requesting originals and resets pagination when filtering", async () => {
  render(<ExampleLibrary />);
  expect(screen.getByText("254 of 254 examples")).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(20);
  await userEvent.click(screen.getByRole("button", { name: "Next examples" }));
  expect(screen.getByText("Page 2 of 13")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Format"), "CODA");
  expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  expect(fetchExampleOriginal).not.toHaveBeenCalled();
});

it("distinguishes third-party Belgian CODA fixtures from bank originals", async () => {
  render(<ExampleLibrary />);
  await userEvent.selectOptions(screen.getByLabelText("Provenance"), "third-party");
  expect(screen.getByText("29 of 254 examples")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Bank or publisher"), "publisher:acsone/pycoda");
  const rows = screen.getAllByRole("article");
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(within(row).getByText("Third-party fixture")).toBeInTheDocument();
    expect(within(row).getByText(/Bank: Bank not verified/)).toBeInTheDocument();
    expect(within(row).getByText(/Belgian CODA format; bank authorship/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Publisher .* download/ })).toHaveAttribute("rel", "noopener noreferrer");
  }
});

it("deep links to archive payloads and offers a clear publisher fallback on failure", async () => {
  vi.mocked(fetchExampleOriginal).mockRejectedValue(new Error("network"));
  render(<ExampleLibrary initialBank="bmo" />);
  expect(screen.getByText("4 of 254 examples")).toBeInTheDocument();
  const row = screen.getAllByRole("article")[0];
  expect(within(row).getByText(/Extracted payload/)).toBeInTheDocument();
  await userEvent.click(within(row).getByRole("button", { name: "Save original file" }));
  expect(await within(row).findByRole("alert")).toHaveTextContent("Use the publisher download");
  expect(within(row).getByRole("link", { name: "Publisher XLSX download ↗" })).toBeInTheDocument();
  expect(downloadBlob).not.toHaveBeenCalled();
});

it("saves exact original bytes only on explicit action and aborts an abandoned download", async () => {
  vi.mocked(fetchExampleOriginal).mockResolvedValue(new Uint8Array([1, 2, 3]));
  const view = render(<ExampleLibrary initialBank="ing" />);
  const row = screen.getAllByRole("article")[0];
  await userEvent.click(within(row).getByRole("button", { name: "Save original file" }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  vi.mocked(fetchExampleOriginal).mockImplementation((_source, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  await userEvent.click(within(row).getByRole("button", { name: "Save original file" }));
  const signal = vi.mocked(fetchExampleOriginal).mock.calls[1][1];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  expect(downloadBlob).toHaveBeenCalledTimes(1);
});

it("filters synthetic examples, preserves invalid labels and loads only the selected test file", async () => {
  const onTry = vi.fn();
  render(<ExampleLibrary onTry={onTry} />);
  await userEvent.selectOptions(screen.getByLabelText("Provenance"), "synthetic");
  await userEvent.type(screen.getByLabelText("Search example files"), "missing trailer");
  const row = screen.getAllByRole("article")[0];
  expect(within(row).getByText("Expected rejection")).toBeInTheDocument();
  await userEvent.click(within(row).getByRole("button", { name: "Try in converter" }));
  await waitFor(() => expect(onTry).toHaveBeenCalledTimes(1));
  await userEvent.click(within(row).getByRole("button", { name: "Download test file" }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(screen.getByText("254 of 254 examples")).toBeInTheDocument();
});
