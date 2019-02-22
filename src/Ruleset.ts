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
export class RulesetContext {
  constructor(
    private readonly pf: PicoFramework, // hide from the ruleset
    private readonly pico: Pico, // hide from the ruleset
    public readonly config: { [name: string]: any }
  ) {
    Object.freeze(this.config);
  }

  newChannel(): void {
    // TODO create a new channel
  }

  listChannels() {}

  newPico(): void {
    // TODO create a child pico
    // TODO create an admin channel to that pico
  }

  raiseEvent(domain: string, name: string, data: PicoEventPayload): void {
    // TODO add an event to the current schedule
  }
}

export interface RulesetInstance {
  event?(event: PicoEvent): Promise<void> | void;

  query?: {
    [name: string]: (args: { [key: string]: any }) => any;
  };
}
