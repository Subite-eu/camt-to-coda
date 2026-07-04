import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { Header } from "./Header";

function renderHeader(props: Partial<Parameters<typeof Header>[0]> = {}) {
  return render(
    <ThemeProvider attribute="class">
      <Header
        direction="camt-to-coda"
        onDirectionChange={() => {}}
        anonymize={false}
        onAnonymizeChange={() => {}}
        onDownload={() => {}}
        canDownload
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("Header", () => {
  it("fires onDirectionChange when a direction is chosen", async () => {
    const onDir = vi.fn();
    renderHeader({ onDirectionChange: onDir });
    await userEvent.click(screen.getByRole("radio", { name: /CODA → CAMT/i }));
    expect(onDir).toHaveBeenCalledWith("coda-to-camt");
  });

  it("disables download when canDownload is false", () => {
    renderHeader({ canDownload: false });
    expect(screen.getByRole("button", { name: /download/i })).toBeDisabled();
  });

  it("toggles anonymize", async () => {
    const onAnon = vi.fn();
    renderHeader({ onAnonymizeChange: onAnon });
    await userEvent.click(screen.getByRole("switch"));
    expect(onAnon).toHaveBeenCalledWith(true);
  });
});
