import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileBar } from "./FileBar";

describe("FileBar", () => {
  it("shows a valid badge and a warning count", () => {
    render(
      <FileBar fileName="x.cod" recordCount={13} validation={{ valid: true, errors: [], warnings: ["balance note"] }} onClear={() => {}} />,
    );
    expect(screen.getByText(/valid/i)).toBeInTheDocument();
    expect(screen.getByText(/1 note/i)).toBeInTheDocument();
  });

  it("shows an error badge when invalid", () => {
    render(<FileBar fileName="x.cod" recordCount={0} validation={{ valid: false, errors: ["bad"], warnings: [] }} onClear={() => {}} />);
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
  });

  it("fires onClear", async () => {
    const onClear = vi.fn();
    render(<FileBar fileName="x.cod" recordCount={1} validation={{ valid: true, errors: [], warnings: [] }} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: /load another file/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
