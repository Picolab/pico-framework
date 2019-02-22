import { PicoEvent } from "./PicoEvent";

export interface Ruleset {
  rid: string;
  version: string;
  dependencies?: {
    [rid: string]: {
      version: string;
      configure: any;
      as: string;
    };
  };
  init(conf: RulesetConf): RulesetInstance;
}

export interface RulesetConf {
  configure: { [name: string]: any };
  dependencies: { [as: string]: any };
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };

  provides?: {
    [name: string]: any;
  };
}
