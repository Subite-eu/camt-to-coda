import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropZone } from "./DropZone";
import { SAMPLES } from "@/lib/samples";

describe("DropZone", () => {
  it("loads a sample (with its direction) on click", async () => {
    const onLoad = vi.fn();
    render(<DropZone onLoad={onLoad} />);
    await userEvent.click(screen.getAllByRole("button", { name: /sample:/i })[0]);
    await waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad.mock.calls[0][1]).toMatch(/camt-to-coda|coda-to-camt/);
  });

  it("shows the drop prompt and a browse button", () => {
    render(<DropZone onLoad={() => {}} />);
    expect(screen.getByText(/drop a camt xml or coda file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
  });

  it("recovers from an unavailable sample by accepting a local file", async () => {
    const onLoad = vi.fn();
    const load = vi.spyOn(SAMPLES[0], "load").mockRejectedValueOnce(new Error("Offline"));
    try {
      render(<DropZone onLoad={onLoad} />);
      await userEvent.click(screen.getByRole("button", { name: "Sample: CAMT 053 statement" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("The sample could not be loaded");
      expect(onLoad).not.toHaveBeenCalled();
      const file = new File(["local source"], "local.cod");
      Object.defineProperty(file, "text", { value: async () => "local source" });
      fireEvent.change(screen.getByLabelText("Choose CAMT or CODA file"), { target: { files: [file] } });
      await waitFor(() => expect(onLoad).toHaveBeenCalledWith("local source", undefined, "local.cod"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally { load.mockRestore(); }
  });

  it("does not replace a newer local upload when a delayed sample finishes", async () => {
    const onLoad = vi.fn();
    let finish!: (content: string) => void;
    const load = vi.spyOn(SAMPLES[0], "load").mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    try {
      render(<DropZone onLoad={onLoad} />);
      await userEvent.click(screen.getByRole("button", { name: "Sample: CAMT 053 statement" }));
      expect(screen.getByText("Loading sample…")).toHaveAttribute("role", "status");
      const file = new File(["newer source"], "newer.cod");
      Object.defineProperty(file, "text", { value: async () => "newer source" });
      fireEvent.change(screen.getByLabelText("Choose CAMT or CODA file"), { target: { files: [file] } });
      await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
      await act(async () => { finish("stale sample"); });
      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenCalledWith("newer source", undefined, "newer.cod");
    } finally { load.mockRestore(); }
  });
});
