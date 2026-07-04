import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import App from "./App";

function renderApp() {
  return render(
    <ThemeProvider attribute="class">
      <App />
    </ThemeProvider>,
  );
}

describe("App (integration)", () => {
  it("loads a sample and inspects a field end to end", async () => {
    renderApp();
    // empty state
    expect(screen.getByText(/drop a camt xml or coda file/i)).toBeInTheDocument();
    // load the CAMT sample
    await userEvent.click(screen.getByRole("button", { name: /sample: camt 053/i }));
    // panels render
    expect(screen.getByText(/Output · CODA/i)).toBeInTheDocument();
    expect(screen.getByText(/Source · CAMT/i)).toBeInTheDocument();
    // click the account field → inspector shows the mapping
    const acctBtn = screen.getAllByRole("button").find((b) => /BE68539007547034/.test(b.textContent || ""));
    expect(acctBtn).toBeDefined();
    await userEvent.click(acctBtn!);
    expect(screen.getByText(/Field mapping/i)).toBeInTheDocument();
    expect(screen.getByText(/accountNumber/)).toBeInTheDocument();
  });

  it("shows the valid badge in the file bar after loading", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /sample: camt 053/i }));
    expect(screen.getByText(/✓ Valid/i)).toBeInTheDocument();
  });
});
