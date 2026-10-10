import {it,expect} from "vitest";
import {render,screen,within} from "@testing-library/react";
import {StatementSummary} from "./StatementSummary";
import {convert} from "@/lib/convert";
it("counts account movements and reconciliation once when monetary breakdown rows exist",async()=> {
  const coda=(await import("../../../examples/coda/coda-monetary-details.cod?raw")).default;
  const r=convert(coda,"coda-to-camt",false);
  render(<StatementSummary statement={r.statements[0]} index={r.fieldIndexes[0]} onSelect={()=>{}} />);
  const region=screen.getByRole("region",{name:"Statement summary"});
  const label=within(region).getByText("Movements");expect(label.nextElementSibling).toHaveTextContent("1");
  expect(within(region).getByRole("table")).toHaveTextContent("12.345 EUR");
  expect(within(region).getAllByRole("row")).toHaveLength(2);
  expect(within(region).getByText("0.000 EUR")).toBeInTheDocument();
});
