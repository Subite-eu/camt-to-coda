import { convert } from "./convert";
import type { Direction } from "./convert";
self.onmessage = (event: MessageEvent<{ input: string; direction: Direction; anonymize: boolean }>) => {
  self.postMessage(convert(event.data.input, event.data.direction, event.data.anonymize));
};
