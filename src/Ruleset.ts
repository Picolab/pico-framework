import { PicoEvent } from "./PicoEvent";
import { RulesetContext } from "./RulesetContext";

export interface Ruleset {
  rid: string;
  version: string;
  init(conf: RulesetContext): RulesetInstance;
}

export interface RulesetConfig {
  [name: string]: any;
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
