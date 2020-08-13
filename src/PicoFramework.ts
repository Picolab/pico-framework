import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel } from "./Channel";
import { dbRange } from "./dbRange";
import { Pico } from "./Pico";
import { cleanEvent, PicoEvent } from "./PicoEvent";
import { PicoFrameworkEvent } from "./PicoFrameworkEvent";
import { cleanQuery, PicoQuery } from "./PicoQuery";
import { Ruleset, RulesetConfig } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");
const memdown = require("memdown");

export type RulesetLoader = (
  picoId: string,
  rid: string,
  config: RulesetConfig
) => Ruleset | Promise<Ruleset>;

type OnFrameworkEvent = (event: PicoFrameworkEvent) => void;

export interface PicoFrameworkConf {
  rulesetLoader: RulesetLoader;
  leveldown?: AbstractLevelDOWN;
  genID?: () => string;
  environment?: any;
  onFrameworkEvent?: OnFrameworkEvent;
  useEventInputTime?: boolean;
}

export class PicoFramework {
  db: LevelUp;

  private rootPico_?: Pico;
  public get rootPico(): Pico {
    if (!this.rootPico_) {
      throw new Error("rootPico has not started up yet");
    }
    return this.rootPico_;
  }

  private picos: Pico[] = [];

  private startupP: Promise<void>;
  genID: () => string;

  private rulesetLoader: RulesetLoader;

  readonly environment?: any;

  private useEventInputTime: boolean = false;

  /**
   * not using EventEmitter b/c I want it typed checked and limited.
   */
  private onFrameworkEvent?: OnFrameworkEvent;

  constructor(conf: PicoFrameworkConf) {
    this.db = level(
      encode((conf && conf.leveldown) || memdown(), {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec,
      })
    );
    this.rulesetLoader = conf && conf.rulesetLoader;
    this.genID = (conf && conf.genID) || cuid;
    this.environment = conf && conf.environment;
    this.onFrameworkEvent = conf && conf.onFrameworkEvent;
    this.useEventInputTime = !!(conf && conf.useEventInputTime);

    this.startupP = this.startup();
  }

  private async startup() {
    this.emit({ type: "startup" });

    await dbRange(this.db, { prefix: ["pico"] }, (data) => {
      const pico = Pico.fromDb(this, data.value);
      this.picos.push(pico);
    });

    await dbRange(this.db, { prefix: ["pico-channel"] }, (data) => {
      const { picoId } = data.value;
      const pico = this.picos.find((pico) => pico.id === picoId);
      if (!pico) {
        throw new Error(`Missing picoId ${picoId}`);
      }
      const chann = Channel.fromDb(pico, data.value);
      pico.channels[chann.id] = chann;
    });

    // get rids that are used, and load them
    // install separate so they are all loaded/warmed up first in case of dependencies
    const toInstall: { pico: Pico; rs: Ruleset; config: any }[] = [];
    await dbRange(this.db, { prefix: ["pico-ruleset"] }, async (data) => {
      const picoId = data.key[1];
      const rid = data.key[2];
      const config = data.value.config;
      const pico = this.picos.find((pico) => pico.id === picoId);
      if (!pico) {
        throw new Error(`Missing picoId ${picoId}`);
      }
      // load ruleset map so when rulesets startup they can see all the available ruleset+config on the pico
      pico.rulesets[rid] = { config, instance: null };
      try {
        const rs = await this.rulesetLoader(picoId, rid, data.value.config);
        toInstall.push({ pico, rs, config: data.value.config });
      } catch (error) {
        pico.rulesets[rid] = { config, instance: null, startupError: error };
        this.emit({
          type: "startupRulesetInitError",
          picoId,
          rid,
          config: data.value.config,
          error,
        });
      }
    });

    for (const { pico, rs, config } of toInstall) {
      try {
        await pico.install(rs, config);
      } catch (error) {
        this.emit({
          type: "startupRulesetInitError",
          picoId: pico.id,
          rid: rs.rid,
          config,
          error,
        });
      }
    }

    let rootId: string | null;
    try {
      rootId = await this.db.get(["root-pico"]);
    } catch (err) {
      if (err.notFound) {
        rootId = null;
      } else {
        throw err;
      }
    }
    if (rootId) {
      this.rootPico_ = this.picos.find((pico) => pico.id === rootId);
      if (!this.rootPico_) {
        throw new Error(`Bad root pico ID ${rootId}`);
      }
    } else {
      const pico = new Pico(this, this.genID());
      await this.db.batch([
        pico.toDbPut(),
        { type: "put", key: ["root-pico"], value: pico.id },
      ]);
      this.rootPico_ = pico;
      this.picos.push(pico);
    }

    this.emit({ type: "startupDone" });
  }

  start() {
    return this.startupP;
  }

  cleanEvent(event: PicoEvent): PicoEvent {
    if (this.useEventInputTime) {
      return cleanEvent(event, event.time);
    }
    return cleanEvent(event);
  }

  async event(event: PicoEvent, fromPicoId?: string): Promise<string | any> {
    event = this.cleanEvent(event);

    const channel = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return channel.pico.event(event);
  }

  async eventWait(
    event: PicoEvent,
    fromPicoId?: string
  ): Promise<string | any> {
    event = this.cleanEvent(event);

    const channel = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return channel.pico.eventWait(event);
  }

  async eventQuery(
    event: PicoEvent,
    query: PicoQuery,
    fromPicoId?: string
  ): Promise<any> {
    event = this.cleanEvent(event);
    query = cleanQuery(query);
    if (query.eci !== event.eci) {
      throw new Error("eventQuery must use the same channel");
    }

    const channel = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);
    channel.assertQueryPolicy(query, fromPicoId);

    return channel.pico.eventQuery(event, query);
  }

  async query(query: PicoQuery, fromPicoId?: string): Promise<any> {
    query = cleanQuery(query);
    const channel = this.lookupChannel(query.eci);
    channel.assertQueryPolicy(query, fromPicoId);
    return channel.pico.query(query);
  }

  lookupChannel(eci: string): Channel {
    for (const pico of this.picos) {
      if (pico.channels[eci]) {
        return pico.channels[eci];
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  getPico(eci: string): Pico {
    for (const pico of this.picos) {
      if (pico.channels[eci]) {
        return pico;
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  reInitRuleset(rs: Ruleset) {
    for (const pico of this.picos) {
      pico.reInitRuleset(rs).catch((err) => {
        this.emit({
          type: "reInitRulesetError",
          picoId: pico.id,
          rid: rs.rid,
          config: pico.rulesets[rs.rid]?.config,
        });
      });
    }
  }

  /**
   * @ignore
   *
   * NOTE: not using EventEmitter so we can have type information and it can be synchronous
   */
  emit(event: PicoFrameworkEvent) {
    if (!this.onFrameworkEvent) return;
    this.onFrameworkEvent(event);
  }

  /**
   * @ignore
   */
  addPico(pico: Pico) {
    this.picos.push(pico);
  }

  /**
   * @ignore
   */
  removePico(picoId: string) {
    this.picos = this.picos.filter((p) => p.id !== picoId);
    this.emit({ type: "picoDeleted", picoId });
  }

  /**
   * Return the number of pico's
   * Useful for testing
   */
  numberOfPicos() {
    return this.picos.length;
  }
}
