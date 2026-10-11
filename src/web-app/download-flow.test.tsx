import { it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import App from "./App";
import basic from "../../examples/camt/camt.053.001.08.xml?raw";
import coda from "../../examples/coda/coda-basic-eur.cod?raw";
import notes from "../../examples/camt/camt-repeated-entry-details.xml?raw";
function app() { render(<ThemeProvider attribute="class"><App /></ThemeProvider>); }
async function upload(text: string) {
  const file = new File([text], "statement.txt");
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("Choose CAMT or CODA file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Statement summary" });
}
it("offers the converted filename and a format-specific download beside the result", async () => {
  app(); await upload(basic);
  const result = within(screen.getByRole("region", { name: "Converted file" }));
  expect(result.getByRole("button", { name: "Download CODA (.cod)" })).toBeEnabled();
  expect(result.getByText(/\.cod$/)).toBeVisible();
  expect(result.getByRole("heading", { name: "Ready to download" })).toBeVisible();
});
it("labels reverse downloads as CAMT XML and explains that they include every statement", async () => {
  app(); await upload(coda);
  const result = within(screen.getByRole("region", { name: "Converted file" }));
  expect(result.getByRole("button", { name: "Download CAMT (.xml)" })).toBeEnabled();
  expect(result.getByText(/all statements/i)).toBeVisible();
});
it("keeps conversion notes next to the disabled download and enables it after review", async () => {
  app(); await upload(notes);
  const result = within(screen.getByRole("region", { name: "Converted file" }));
  const button = result.getByRole("button", { name: "Download CODA (.cod)" });
  expect(button).toBeDisabled();
  await userEvent.click(result.getByRole("checkbox", { name: /I reviewed the conversion notes/ }));
  expect(button).toBeEnabled();
});
it("cannot unlock a validation failure by acknowledging conversion notes", async () => {
  app(); await upload(notes.replace('<Amt Ccy="EUR">112.345</Amt>', '<Amt Ccy="USD">112.345</Amt>'));
  const result = within(screen.getByRole("region", { name: "Converted file" }));
  await userEvent.click(result.getByRole("checkbox", { name: /I reviewed the conversion notes/ }));
  expect(result.getByRole("button", { name: "Download CODA (.cod)" })).toBeDisabled();
  expect(result.getByRole("heading", { name: "Download unavailable" })).toBeVisible();
});
