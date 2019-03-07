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

  private rootPico?: Pico;
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

    try {
      const id = await this.db.get(["root-pico"]);
      this.rootPico = this.picos.find(pico => pico.id === id);
    } catch (err) {
      if (!err.notFound) {
        throw err;
      }
    }

    if (!this.rootPico) {
      // TODO load root-pico

      const pico = new Pico(this, this.genID());
      await this.db.batch([
        pico.toDbPut(),
        { type: "put", key: ["root-pico"], value: pico.id }
      ]);
      this.rootPico = pico;
      this.picos.push(pico);
    }
  }

  start() {
    return this.startupP;
  }

  async getRootPico(): Promise<Pico> {
    await this.start();
    if (!this.rootPico) {
      throw new Error("No rootPico");
    }
    return this.rootPico;
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

  addPico(pico: Pico) {
    this.picos.push(pico);
  }

  removePico(picoId: string) {
    this.picos = this.picos.filter(p => p.id !== picoId);
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

  _test_allECIs(): string[] {
    const list: string[] = [];
    for (const pico of this.picos) {
      for (const channel of Object.values(pico.channels)) {
        list.push(channel.id);
      }
    }
    return list;
  }

  _test_allPicoIDs(): string[] {
    return this.picos.map(p => p.id);
  }
}
