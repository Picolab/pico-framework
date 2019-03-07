import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel } from "./Channel";
import { Pico } from "./Pico";
import { cleanEvent, PicoEvent } from "./PicoEvent";
import { cleanQuery, PicoQuery } from "./PicoQuery";
import { Ruleset } from "./Ruleset";
import { dbRange } from "./dbRange";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

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

  constructor(leveldown: AbstractLevelDOWN, genID: () => string = cuid) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );

    this.genID = genID;
    this.startupP = this.startup();
  }

  private async startup() {
    await dbRange(this.db, { prefix: ["pico"] }, data => {
      const pico = Pico.fromDb(this, data.value);
      this.picos.push(pico);
    });

    await dbRange(this.db, { prefix: ["pico-channel"] }, data => {
      const chann = Channel.fromDb(data.value);
      const pico = this.picos.find(pico => pico.id === chann.picoId);
      if (!pico) {
        throw new Error(`Missing picoId ${chann.picoId}`);
      }
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

    const { pico, channel } = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return pico.event(event);
  }

  async eventWait(
    event: PicoEvent,
    fromPicoId?: string
  ): Promise<string | any> {
    event = cleanEvent(event);

    const { pico, channel } = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return pico.eventWait(event);
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

    const { pico, channel } = this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);
    channel.assertQueryPolicy(query, fromPicoId);

    return pico.eventQuery(event, query);
  }

  async query(query: PicoQuery, fromPicoId?: string): Promise<any> {
    query = cleanQuery(query);
    const { pico, channel } = this.lookupChannel(query.eci);
    channel.assertQueryPolicy(query, fromPicoId);
    return pico.query(query);
  }

  lookupChannel(
    eci: string
  ): {
    pico: Pico;
    channel: Channel;
  } {
    for (const pico of this.picos) {
      if (pico.channels[eci]) {
        return { pico, channel: pico.channels[eci] };
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
