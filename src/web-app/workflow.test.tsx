import {it,expect} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ThemeProvider} from "next-themes";
import App from "./App";
import {SAMPLES} from "./lib/samples";
function app(){return render(<ThemeProvider attribute="class"><App/></ThemeProvider>);}
async function upload(text:string,name="private-bank.xml") {
  const file=new File([text],name,{type:"text/plain"});Object.defineProperty(file,"text",{value:async()=>text});
  fireEvent.change(screen.getByLabelText("Choose CAMT or CODA file"),{target:{files:[file]}});
}
it("detects reverse uploads and retains the original filename",async()=> {
  app();await upload(SAMPLES[1].content,"original.cod");
  expect(await screen.findByRole("heading",{name:"Statement summary"})).toBeInTheDocument();
  expect(screen.getByRole("radio",{name:"CODA → CAMT"})).toHaveAttribute("aria-checked","true");
  expect(screen.getByText(/original.cod.*Detected CODA/)).toBeInTheDocument();
});
it("preserves source on failure, blocks downloads and offers recovery",async()=> {
  app();await upload("<Document>broken source");
  await screen.findByRole("heading",{name:"Conversion needs attention"});
  expect(screen.getByRole("button",{name:"Download"})).toBeDisabled();
  expect(screen.getByLabelText("Original source")).toHaveTextContent("broken source");
  await userEvent.click(screen.getAllByRole("button",{name:"Load another file"})[0]);
  expect(screen.getByRole("heading",{name:/Drop a CAMT/})).toBeInTheDocument();
});
it("shows every statement and requires review of warnings before download",async()=> {
  app();const sample=SAMPLES[0].content.replace("39679.56","39680.56");
  const multi=sample.replace("</Stmt>","</Stmt>"+sample.match(/<Stmt>[\s\S]*?<\/Stmt>/)![0]);
  await upload(multi);
  await screen.findByRole("heading",{name:"Statement summary"});
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(screen.getByRole("button",{name:"Download"})).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox",{name:/I reviewed/}));
  expect(screen.getByRole("button",{name:"Download"})).toBeEnabled();
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Statement"}),"1");
  expect(screen.getByRole("button",{name:"Download"})).toBeDisabled();
});
it("announces mapped selection and supports Escape dismissal",async()=> {
  app();await userEvent.click(screen.getByRole("button",{name:/Sample: CAMT/}));
  await screen.findByRole("heading",{name:"Statement summary"});
  await userEvent.click(screen.getByRole("button",{name:"Inspect movement 1"}));
  expect(screen.getByRole("region",{name:"Selected field"})).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/amount.*derived/);
  expect(screen.getByRole("button",{name:/Record 2.1, amount,/})).toHaveAttribute("aria-pressed","true");
  fireEvent.keyDown(document,{key:"Escape"});
  await waitFor(()=>expect(screen.queryByRole("region",{name:"Selected field"})).not.toBeInTheDocument());
});
