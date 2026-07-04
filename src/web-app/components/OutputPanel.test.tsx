import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { convert } from "@/lib/convert";
import { buildFieldIndex } from "@/lib/fields";
import { OutputPanel } from "./OutputPanel";

const CAMT = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr><Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct><Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal><Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal></Stmt></BkToCstmrStmt></Document>`;

describe("OutputPanel", () => {
  it("clicking a field fires onSelect with its id", async () => {
    const r = convert(CAMT, "camt-to-coda", false);
    const idx = buildFieldIndex(r.codaLines);
    const onSelect = vi.fn();
    render(<OutputPanel title="Output · CODA" lines={r.codaLines} index={idx} selectedId={null} onSelect={onSelect} />);
    const fieldButton = screen.getAllByRole("button").find((b) => /BE68539007547034/.test(b.textContent || ""));
    expect(fieldButton).toBeDefined();
    await userEvent.click(fieldButton!);
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("accountNumber"));
  });
});
