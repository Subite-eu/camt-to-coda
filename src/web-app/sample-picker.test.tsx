import { it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import App from "./App";
it("finds a payment scenario by search and format and loads it for download", async () => {
  render(<ThemeProvider attribute="class"><App /></ThemeProvider>);
  const library = within(screen.getByRole("region", { name: "Sample library" }));
  await userEvent.type(library.getByRole("searchbox", { name: "Search samples" }), "salary");
  await userEvent.selectOptions(library.getByRole("combobox", { name: "Sample format" }), "coda");
  expect(library.queryByRole("button", { name: /Load sample: CAMT/ })).not.toBeInTheDocument();
  await userEvent.click(library.getByRole("button", { name: /Load sample: CODA.*Salary/ }));
  await screen.findByRole("heading", { name: "Statement summary" });
  expect(screen.getByRole("region", { name: "Statement summary" })).toHaveTextContent("1050.000 EUR");
  expect(screen.getByRole("button", { name: "Download CAMT (.xml)" })).toBeEnabled();
});
it("keeps deliberately invalid samples opt-in and explains their expected failure", async () => {
  render(<ThemeProvider attribute="class"><App /></ThemeProvider>);
  const library = within(screen.getByRole("region", { name: "Sample library" }));
  await userEvent.type(library.getByRole("searchbox", { name: "Search samples" }), "missing trailer");
  expect(library.queryByRole("button", { name: /Load sample:/ })).not.toBeInTheDocument();
  await userEvent.click(library.getByRole("checkbox", { name: "Include invalid examples" }));
  expect(library.getByText("Expected error")).toBeVisible();
  expect(library.getByRole("button", { name: /Load sample: CODA.*Missing trailer/ })).toHaveAccessibleDescription(/Expected rejection:.*Expected error/);
  await userEvent.click(library.getByRole("button", { name: /Load sample: CODA.*Missing trailer/ }));
  await screen.findByRole("heading", { name: "Conversion needs attention" });
  expect(screen.getByRole("button", { name: "Download CAMT (.xml)" })).toBeDisabled();
});
