import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { BankCatalog } from "./BankCatalog";

it("filters primary bank resources by geography, bank and resource type", async () => {
  render(<BankCatalog />);
  expect(screen.getByRole("heading", { name: "Bank reporting catalog" })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Region"), "Africa");
  expect(screen.getByRole("heading", { name: "FNB / FirstRand Bank" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "ING" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Resource type"), "sample-file");
  expect(screen.getByText(/No banks match/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  await userEvent.type(screen.getByLabelText("Search banks and reporting formats"), "ING camt.052");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  const ing = screen.getByRole("article", { name: "ING" });
  expect(within(ing).getAllByRole("link").length).toBeGreaterThan(0);
  expect(screen.queryByRole("heading", { name: "Nordea" })).not.toBeInTheDocument();
});

it("labels access and converter boundaries and uses safe external links", async () => {
  render(<BankCatalog />);
  expect(screen.getByText(/CAMT054 and wrapped/)).toBeInTheDocument();
  expect(screen.getByText(/Account and channel eligibility/)).toBeInTheDocument();
  for (const link of screen.getAllByRole("link").filter(l => l.getAttribute("target") === "_blank")) {
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href")).toMatch(/^https:\/\//);
  }
});

it("shows national reporting scope and does not retain filters across catalog sections", async () => {
  render(<BankCatalog />);
  await userEvent.selectOptions(screen.getByLabelText("Region"), "Africa");
  await userEvent.click(screen.getByRole("button", { name: /Country & regional references/ }));
  expect(screen.getByLabelText("Region")).toHaveValue("");
  await userEvent.selectOptions(screen.getByLabelText("Country / market"), "France");
  expect(screen.getByRole("heading", { name: /CFONB/ })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Region"), "Oceania");
  expect(screen.getByLabelText("Country / market")).toHaveValue("");
  await userEvent.type(screen.getByLabelText("Search authorities and message formats"), "nonexistent-authority");
  expect(screen.getByText(/No references match/)).toBeInTheDocument();
});

it("finds national technical files and original examples through resource filters", async () => {
  render(<BankCatalog />);
  await userEvent.click(screen.getByRole("button", { name: /Country & regional references/ }));
  await userEvent.selectOptions(screen.getByLabelText("Country / market"), "Switzerland");
  await userEvent.selectOptions(screen.getByLabelText("Resource type"), "specification");
  expect(screen.getByRole("heading", { name: "SIX Interbank Clearing AG" })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Country / market"), "Czech Republic");
  await userEvent.selectOptions(screen.getByLabelText("Resource type"), "sample-file");
  const entry = screen.getByRole("article", { name: "Czech Banking Association (CBA)" });
  expect(within(entry).getByRole("link", { name: /camt053 national example/ })).toHaveAttribute("href", "https://cbaonline.cz/journal_files_storage/camt053_vypis.xml");
});

it("keeps North American reporting scope and unavailable public evidence discoverable", async () => {
  render(<BankCatalog />);
  await userEvent.selectOptions(screen.getByLabelText("Region"), "North America");
  expect(screen.getByRole("link", { name: /Full North America bank-by-bank review/ })).toHaveAttribute("href", expect.stringContaining("north-america-review.md"));
  await userEvent.selectOptions(screen.getByLabelText("Country / market"), "Canada");
  await userEvent.type(screen.getByLabelText("Search banks and reporting formats"), "RBC");
  const canada = screen.getByRole("article", { name: "RBC / Royal Bank of Canada" });
  expect(within(canada).getByText(/Exact schema versions are unstated/)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /RBC Clear/ })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Country / market"), "United States");
  const us = screen.getByRole("article", { name: /RBC Clear/ });
  expect(within(us).getByText(/camt.054 v8/)).toBeInTheDocument();
  expect(within(us).getByText(/client-gated/)).toBeInTheDocument();
});
