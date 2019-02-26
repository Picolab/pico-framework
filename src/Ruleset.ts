import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from ".";
import { Pico } from "./Pico";
import { PicoQuery } from "./PicoQuery";
import { ChannelConfig } from "./Channel";

export interface Ruleset {
  rid: string;
  version: string;
  init(conf: RulesetContext): RulesetInstance;
}

/**
 * Give rulesets limited access to the framework/pico that it's running in.
 */
export interface RulesetContext {
  config: any;

  send(event: PicoEvent, query?: PicoQuery): Promise<string | any>;
  query(query: PicoQuery): Promise<any>;

  newPico(): Promise<void>;
  newChannel(conf?: ChannelConfig): Promise<string>;
  listChannels(): Promise<void>;

  raiseEvent(domain: string, name: string, data: PicoEventPayload): void;
}

export function createRulesetContext(
  pf: PicoFramework,
  pico: Pico,
  config: any
): RulesetContext {
  // not using a class constructor b/c private is not really private
  return {
    config,

    send(event, query) {
      return pf.send(event, query);
    },
    query(query) {
      return pf.query(query);
    },

    async newPico() {
      // TODO
      // Parent is the one calling
    },
    async newChannel(conf) {
      const chann = await pico.newChannel(conf);
      return chann.id;
    },
    async listChannels() {
      // TODO
    },

    raiseEvent() {
      // TODO
    }
  };
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
