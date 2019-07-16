import { PicoFramework } from ".";
import { ChannelConfig, ChannelReadOnly } from "./Channel";
import { NewPicoConfig, Pico, PicoReadOnly, PicoRulesetReadOnly } from "./Pico";
import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoQuery } from "./PicoQuery";
import { RulesetConfig } from "./Ruleset";

/**
 * Give rulesets limited access to the framework/pico that it's running in.
 */
export interface RulesetContext {
  ruleset: PicoRulesetReadOnly;

  pico(): PicoReadOnly;

  event(event: PicoEvent): Promise<string>;
  eventQuery(event: PicoEvent, query: PicoQuery): Promise<any>;
  query(query: PicoQuery): Promise<any>;

  newPico(conf?: NewPicoConfig): Promise<string>;
  delPico(eci: string): Promise<void>;

  newChannel(conf?: ChannelConfig): Promise<ChannelReadOnly>;
  putChannel(eci: string, conf: ChannelConfig): Promise<ChannelReadOnly>;
  delChannel(eci: string): Promise<void>;

  install(rid: string, version: string, config: RulesetConfig): Promise<void>;
  uninstall(rid: string): Promise<void>;

  getEnt(name: string): Promise<any>;
  putEnt(name: string, value: any): Promise<void>;
  delEnt(name: string): Promise<void>;

  raiseEvent(
    domain: string,
    name: string,
    attrs: PicoEventPayload["attrs"]
  ): void;
  clearSchedule(): void;
}

/**
 * This is a constructor function to be sure that we don't leak things that a ruleset should not have access to.
 *
 * @param pf the framework
 * @param pico the pico the ruleset is installed on
 * @param ruleset info/config about the installed ruleset
 */
export function createRulesetContext(
  pf: PicoFramework,
  pico: Pico,
  ruleset: PicoRulesetReadOnly
): RulesetContext {
  const rid = ruleset.rid;
  return {
    ruleset,

    event(event) {
      return pf.event(event, pico.id);
    },
    eventQuery(event, query) {
      return pf.eventQuery(event, query, pico.id);
    },
    query(query) {
      return pf.query(query, pico.id);
    },

    pico() {
      return pico.toReadOnly();
    },
    newPico(conf) {
      return pico.newPico(conf);
    },
    delPico(eci) {
      return pico.delPico(eci);
    },

    async newChannel(conf) {
      const chann = await pico.newChannel(conf);
      return chann.toReadOnly();
    },

    async putChannel(eci, conf) {
      const chann = await pico.putChannel(eci, conf);
      return chann.toReadOnly();
    },

    delChannel(eci) {
      return pico.delChannel(eci);
    },

    install(rid, version, config) {
      return pico.install(rid, version, config);
    },

    uninstall(rid) {
      return pico.uninstall(rid);
    },

    getEnt(name) {
      return pico.getEnt(rid, name);
    },
    putEnt(name, value) {
      return pico.putEnt(rid, name, value);
    },
    delEnt(name) {
      return pico.delEnt(rid, name);
    },

    raiseEvent(domain, name, attrs) {
      return pico.raiseEvent(domain, name, attrs);
    },

    clearSchedule() {
      pico.clearSchedule();
    }
  };
}
