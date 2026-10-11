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
    await userEvent.click(screen.getByRole("button", { name: "Sample: CAMT 053 statement" }));
    await screen.findByRole("heading", { name: "Statement summary" });
    await userEvent.click(screen.getByRole("button", { name: "Inspect fields" }));
    // panels render
    expect(screen.getByText(/Output · CODA/i)).toBeInTheDocument();
    expect(screen.getByText(/Source · CAMT/i)).toBeInTheDocument();
    // click the account field → inspector shows the mapping
    await userEvent.type(screen.getByRole("textbox", { name: /Find a field/ }), "accountNumber");
    const acctBtn = screen.getByRole("button", { name: /Record 1, accountNumber/ });
    expect(acctBtn).toBeDefined();
    await userEvent.click(acctBtn!);
    expect(screen.getByRole("heading", { name: /Field mapping/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /accountNumber/ })).toBeInTheDocument();
  });

  it("shows the valid badge in the file bar after loading", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Sample: CAMT 053 statement" }));
    expect(await screen.findByText(/✓ Valid/i)).toBeInTheDocument();
  });
});
