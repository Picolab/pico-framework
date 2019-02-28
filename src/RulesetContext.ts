import { PicoFramework } from ".";
import { ChannelConfig, ChannelReadOnly } from "./Channel";
import { Pico, PicoReadOnly } from "./Pico";
import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoQuery } from "./PicoQuery";
import { RulesetConfig } from "./Ruleset";

/**
 * Give rulesets limited access to the framework/pico that it's running in.
 */
export interface RulesetContext {
  config: RulesetConfig;
  pico(): PicoReadOnly;

  event(event: PicoEvent): Promise<string>;
  eventQuery(event: PicoEvent, query: PicoQuery): Promise<any>;
  query(query: PicoQuery): Promise<any>;

  newPico(): Promise<PicoReadOnly>;
  delPico(eci: string): Promise<void>;

  newChannel(conf?: ChannelConfig): Promise<ChannelReadOnly>;
  putChannel(eci: string, conf: ChannelConfig): Promise<ChannelReadOnly>;
  delChannel(eci: string): Promise<void>;

  raiseEvent(domain: string, name: string, data: PicoEventPayload): void;
}

/**
 * This is a constructor function to be sure that we don't leak out things a ruleset should not have access to.
 *
 * @param pf pointer to the framework
 * @param pico the pico the ruleset is installed on
 * @param config config the ruleset was installed with
 */
export function createRulesetContext(
  pf: PicoFramework,
  pico: Pico,
  config: any
): RulesetContext {
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
    async delPico(eci) {
      await pico.delPico(eci);
    },

    async newChannel(conf) {
      const chann = await pico.newChannel(conf);
      return chann.toReadOnly();
    },

    async putChannel(eci, conf) {
      const chann = await pico.putChannel(eci, conf);
      return chann.toReadOnly();
    },

    async delChannel(eci) {
      await pico.delChannel(eci);
    },

    raiseEvent(domain, name, data) {
      return pico.raiseEvent(domain, name, data);
    }
  };
}
