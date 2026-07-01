import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropZone } from "./DropZone";

describe("DropZone", () => {
  it("loads a sample (with its direction) on click", async () => {
    const onLoad = vi.fn();
    render(<DropZone onLoad={onLoad} />);
    await userEvent.click(screen.getAllByRole("button", { name: /sample:/i })[0]);
    expect(onLoad).toHaveBeenCalled();
    expect(onLoad.mock.calls[0][1]).toMatch(/camt-to-coda|coda-to-camt/);
  });

  it("shows the drop prompt and a browse button", () => {
    render(<DropZone onLoad={() => {}} />);
    expect(screen.getByText(/drop a camt xml or coda file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
  });
});
