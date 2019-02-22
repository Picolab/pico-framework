import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from ".";
import { Pico } from "./Pico";

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

  newChannel(): void;

  listChannels(): void;

  newPico(): void;

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
    newPico() {
      // TODO
    },
    newChannel() {
      // TODO
    },
    listChannels() {
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
