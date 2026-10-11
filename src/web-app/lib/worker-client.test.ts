import { afterEach, it, expect, vi } from "vitest";
import { startConversion } from "./worker-client";
import { convert } from "./convert";
import basic from "../../../examples/camt/camt.053.001.08.xml?raw";
class FakeWorker {
  static instances:FakeWorker[]=[];
  onmessage:((event:{data:unknown})=>void)|null=null;
  onerror:(()=>void)|null=null;
  terminate=vi.fn(); postMessage=vi.fn();
  constructor(){FakeWorker.instances.push(this);}
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();FakeWorker.instances=[];});
it("terminates a cancelled job and ignores late worker completion",()=> {
  vi.stubGlobal("Worker",FakeWorker);const done=vi.fn();const failed=vi.fn();
  const cancel=startConversion("source","camt-to-coda",false,done,failed);
  const worker=FakeWorker.instances[0];
  expect(worker.postMessage).toHaveBeenCalledWith({input:"source",direction:"camt-to-coda",anonymize:false});
  cancel();worker.onmessage?.({data:{outputText:"stale"}});
  expect(worker.terminate).toHaveBeenCalled();expect(done).not.toHaveBeenCalled();
});
it("returns completed artifacts and terminates its worker",()=> {
  vi.stubGlobal("Worker",FakeWorker);const done=vi.fn();
  startConversion("source","camt-to-coda",false,done,vi.fn());
  const result=convert(basic,"camt-to-coda",false);
  const worker=FakeWorker.instances[0];worker.onmessage?.({data:result});
  expect(done).toHaveBeenCalledWith(result);expect(worker.terminate).toHaveBeenCalled();
});
it("surfaces startup and worker failures as recoverable messages",()=> {
  const failed=vi.fn();vi.stubGlobal("Worker",class {constructor(){throw new Error("blocked");}});
  startConversion("source","camt-to-coda",false,vi.fn(),failed);expect(failed).toHaveBeenCalledWith(expect.stringContaining("could not start"));
  vi.stubGlobal("Worker",FakeWorker);startConversion("source","camt-to-coda",false,vi.fn(),failed);
  FakeWorker.instances[0].onerror?.();expect(failed).toHaveBeenCalledWith(expect.stringContaining("worker stopped"));
});
it("cancels a deferred fallback before any conversion",()=> {
  vi.stubGlobal("Worker",undefined);vi.useFakeTimers();const done=vi.fn();
  startConversion(basic,"camt-to-coda",false,done,vi.fn())();vi.runAllTimers();expect(done).not.toHaveBeenCalled();
});
