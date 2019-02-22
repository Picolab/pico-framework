import { PicoEvent } from "./PicoEvent";

export interface Ruleset {
  rid: string;
  version: string;
  init(conf: RulesetConf): RulesetInstance;
}

export interface RulesetConf {
  configure: { [name: string]: any };
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
