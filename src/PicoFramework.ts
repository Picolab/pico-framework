import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel } from "./Channel";
import { dbRange } from "./dbRange";
import { Pico } from "./Pico";
import { cleanEvent, PicoEvent } from "./PicoEvent";
import { cleanQuery, PicoQuery } from "./PicoQuery";
import { Ruleset } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");
const memdown = require("memdown");

export interface PicoFrameworkConf {
  leveldown?: AbstractLevelDOWN;
  genID?: () => string;
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

  private rulesets: { [rid: string]: { [version: string]: Ruleset } } = {};
  private startupP: Promise<void>;
  genID: () => string;

  constructor(conf?: PicoFrameworkConf) {
    this.db = level(
      encode((conf && conf.leveldown) || memdown(), {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );
    this.genID = (conf && conf.genID) || cuid;
    this.startupP = this.startup();
  }

  private async startup() {
    await dbRange(this.db, { prefix: ["pico"] }, data => {
      const pico = Pico.fromDb(this, data.value);
      this.picos.push(pico);
    });

    await dbRange(this.db, { prefix: ["pico-channel"] }, data => {
      const { picoId } = data.value;
      const pico = this.picos.find(pico => pico.id === picoId);
      if (!pico) {
        throw new Error(`Missing picoId ${picoId}`);
      }
      const chann = Channel.fromDb(pico, data.value);
      pico.channels[chann.id] = chann;
    });

    await dbRange(this.db, { prefix: ["pico-ruleset"] }, async data => {
      const picoId = data.key[1];
      const rid = data.key[2];
      const pico = this.picos.find(pico => pico.id === picoId);
      if (!pico) {
        throw new Error(`Missing picoId ${picoId}`);
      }
      await pico.install(rid, data.value.version, data.value.config);
    });

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
      this.rootPico_ = this.picos.find(pico => pico.id === rootId);
      if (!this.rootPico_) {
        throw new Error(`Bad root pico ID ${rootId}`);
      }
    } else {
      const pico = new Pico(this, this.genID());
      await this.db.batch([
        pico.toDbPut(),
        { type: "put", key: ["root-pico"], value: pico.id }
      ]);
      this.rootPico_ = pico;
      this.picos.push(pico);
    }
  }

  start() {
    return this.startupP;
  }

  async event(event: PicoEvent, fromPicoId?: string): Promise<string | any> {
    event = cleanEvent(event);

    const channel = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return channel.pico.event(event);
  }

  async eventWait(
    event: PicoEvent,
    fromPicoId?: string
  ): Promise<string | any> {
    event = cleanEvent(event);

    const channel = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return channel.pico.eventWait(event);
  }

  async eventQuery(
    event: PicoEvent,
    query: PicoQuery,
    fromPicoId?: string
  ): Promise<any> {
    event = cleanEvent(event);
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

  addRuleset(rs: Ruleset) {
    if (!this.rulesets[rs.rid]) {
      this.rulesets[rs.rid] = {};
    }
    this.rulesets[rs.rid][rs.version] = rs;
  }

  getRuleset(rid: string, version: string): Ruleset {
    if (!this.rulesets[rid]) {
      throw new Error(`Ruleset not found ${rid}@${version}`);
    }
    if (!this.rulesets[rid][version]) {
      throw new Error(`Ruleset version not found ${rid}@${version}`);
    }
    return this.rulesets[rid][version];
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
    this.picos = this.picos.filter(p => p.id !== picoId);
  }

  /**
   * Return the number of pico's
   * Usefull for testing
   */
  numberOfPicos() {
    return this.picos.length;
  }
}
