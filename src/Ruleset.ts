import { PicoFramework } from "./PicoFramework";
import { PicoEvent } from "./PicoEvent";
import { Pico } from "./Pico";

export interface Ruleset {
  rid: string;
  version: string;
  init(pf: PicoFramework, pico: Pico): RulesetInstance;
}

export interface RulesetInstance {
  event(event: PicoEvent): Promise<void> | void;
  query: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
