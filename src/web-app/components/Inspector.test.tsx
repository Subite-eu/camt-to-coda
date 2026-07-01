import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inspector } from "./Inspector";
import type { FieldEntry } from "@/lib/fields";

const FIELD: FieldEntry = {
  id: "1:accountNumber:1",
  recordType: "1",
  name: "accountNumber",
  value: "BE68539007547034",
  codaPos: "6-39",
  sourceXPath: "Acct/Id/IBAN",
  description: "Account number (IBAN)",
  lineIndex: 1,
};

describe("Inspector", () => {
  it("shows the selected field's CODA position and CAMT xpath", () => {
    render(<Inspector field={FIELD} />);
    expect(screen.getByText(/pos 6-39/)).toBeInTheDocument();
    expect(screen.getByText("Acct/Id/IBAN")).toBeInTheDocument();
    expect(screen.getByText("accountNumber")).toBeInTheDocument();
  });

  it("renders nothing when no field is selected", () => {
    const { container } = render(<Inspector field={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
