import {it,expect,vi} from "vitest";
import {render,screen,fireEvent} from "@testing-library/react";
import {SourcePanel} from "./SourcePanel";
import type {FieldEntry} from "@/lib/fields";
it("lets keyboard users select exact XML nodes without tabbing through the whole document",()=> {
  const xml="<a>100</a><a>100</a>";
  const index:FieldEntry[]=[{id:"first",recordType:"2.1",name:"amount",value:"100",codaPos:"33-47",lineIndex:0,sourceXPath:"/a[1]",sourceRange:{start:3,end:6}},{id:"second",recordType:"2.1",name:"amount",value:"100",codaPos:"33-47",lineIndex:1,sourceXPath:"/a[2]",sourceRange:{start:13,end:16}}];
  const select=vi.fn();render(<SourcePanel title="XML" text={xml} index={index} onSelect={select} />);
  const first=screen.getByRole("button",{name:/CAMT \/a\[1\]/});const second=screen.getByRole("button",{name:/CAMT \/a\[2\]/});
  expect(first).toHaveAttribute("tabindex","0");first.focus();fireEvent.keyDown(first,{key:"ArrowDown"});expect(second).toHaveFocus();fireEvent.click(second);expect(select).toHaveBeenCalledWith("second");
});
it("keeps later repeated remittance source fragments selectable as their actual continuation field",async()=> {
  const {convert}=await import("@/lib/convert");
  const xml=(await import("../../../examples/camt/camt-long-remittance.xml?raw")).default;
  const r=convert(xml,"camt-to-coda",false);
  const select=vi.fn();render(<SourcePanel title="CAMT" text={xml} index={r.fieldIndexes[0]} onSelect={select} />);
  const continuation=screen.getAllByRole("button").find(b=>b.textContent?.includes("DDDD"));
  expect(continuation).toBeDefined();fireEvent.click(continuation!);
  expect(select).toHaveBeenCalledWith(expect.stringMatching(/^3.3:communication:/));
});
