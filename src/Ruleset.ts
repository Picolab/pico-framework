import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from ".";
import { Pico, PicoReadOnly } from "./Pico";
import { PicoQuery } from "./PicoQuery";
import { ChannelConfig, ChannelReadOnly } from "./Channel";

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

  event(event: PicoEvent): Promise<string>;
  eventQuery(event: PicoEvent, query: PicoQuery): Promise<any>;
  query(query: PicoQuery): Promise<any>;

  pico(): PicoReadOnly;
  newPico(): Promise<PicoReadOnly>;
  newChannel(conf?: ChannelConfig): Promise<ChannelReadOnly>;

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

    event(event) {
      return pf.event(event);
    },
    eventQuery(event, query) {
      return pf.eventQuery(event, query);
    },
    query(query) {
      return pf.query(query);
    },

    pico() {
      return pico.toReadOnly();
    },
    async newPico() {
      const child = await pico.newPico();
      return child.toReadOnly();
    },
    async newChannel(conf) {
      const chann = await pico.newChannel(conf);
      return chann.toReadOnly();
    },

    raiseEvent(domain, name, data) {
      return pico.raiseEvent(domain, name, data);
    }
  };
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
