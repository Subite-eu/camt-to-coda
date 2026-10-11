import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SampleLibrary } from "./SampleLibrary";

it("separates synthetic fixtures from official bank downloads without fetching bank files", () => {
  render(<SampleLibrary onSelect={vi.fn()} loading={false} />);
  expect(screen.getByText(/104 independently authored synthetic samples/)).toBeInTheDocument();
  const bank = screen.getByRole("group", { name: "Bank-published CAMT examples" });
  expect(within(bank).getAllByRole("link", { name: /^Download /, hidden: true })).toHaveLength(12);
  expect(within(bank).getByText(/Unzip downloads/)).toBeInTheDocument();
  expect(within(bank).getByText(/CODA samples remain synthetic/)).toBeInTheDocument();
  for (const link of within(bank).getAllByRole("link", { hidden: true })) {
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href")).toMatch(/^https:\/\/(assets\.ing\.com|assets\.abnamro\.com|www\.nordea\.com|www\.ingwb\.com|www\.abnamro\.nl)\//);
  }
});
