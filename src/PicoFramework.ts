import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel, ChannelConfig } from "./Channel";
import { Pico } from "./Pico";
import { cleanEvent, PicoEvent } from "./PicoEvent";
import { cleanQuery, PicoQuery } from "./PicoQuery";
import { Ruleset } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

class Persistence {
  // TODO use db instead of in-memory
  private db: LevelUp;

  private picos: Pico[] = [];

  private channels: Channel[] = [];

  constructor(
    leveldown: AbstractLevelDOWN,
    private genID: () => string = cuid
  ) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );
  }

  addPico(pico: Pico) {
    this.picos.push(pico);
  }

  async addChannel(
    picoId: string,
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ) {
    const chann = new Channel(picoId, this.genID(), conf, familyChannelPicoID);
    this.channels.push(chann);
    return chann;
  }

  async getMyChannel(picoId: string, eci: string): Promise<Channel> {
    const { channel } = this.lookupChannel(eci);
    if (picoId !== channel.picoId) {
      throw new Error(`ECI not found ${eci} on pico`);
    }
    return channel;
  }

  getMyChannels(picoId: string): Channel[] {
    return this.channels.filter(c => c.picoId === picoId);
  }

  async delChannel(eci: string) {
    this.channels = this.channels.filter(c => c.id !== eci);
  }

  removePico(picoId: string) {
    this.picos = this.picos.filter(p => p.id !== picoId);
  }

  lookupChannel(eci: string): { pico: Pico; channel: Channel } {
    for (const channel of this.channels) {
      if (channel.id === eci) {
        for (const pico of this.picos) {
          if (pico.id === channel.picoId) {
            return { pico, channel };
          }
        }
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  async getEnt(picoId: string, rid: string, name: string) {
    let data: any;
    try {
      data = await this.db.get(["entvar", picoId, rid, name]);
    } catch (err) {
      if (err.notFound) {
        return null;
      }
    }
    return data;
  }
  async putEnt(picoId: string, rid: string, name: string, value: any) {
    await this.db.put(["entvar", picoId, rid, name], value);
  }
  async delEnt(picoId: string, rid: string, name: string) {
    await this.db.del(["entvar", picoId, rid, name]);
  }

  _test_allECIs(): string[] {
    return this.channels.map(c => c.id);
  }

  _test_allPicoIDs(): string[] {
    return this.picos.map(p => p.id);
  }
}

export class PicoFramework {
  db: Persistence;

  private rulesets: { [rid: string]: { [version: string]: Ruleset } } = {};
  private startupP: Promise<void>;
  private rootPico?: Pico;
  genID: () => string;

  constructor(leveldown: AbstractLevelDOWN, genID: () => string = cuid) {
    this.db = new Persistence(leveldown, genID);
    this.genID = genID;
    this.startupP = this.startup();
  }

  private async startup() {
    if (!this.rootPico) {
      this.rootPico = new Pico(this);
      this.db.addPico(this.rootPico);
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

    const { pico, channel } = this.db.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return pico.event(event);
  }

  async eventWait(
    event: PicoEvent,
    fromPicoId?: string
  ): Promise<string | any> {
    event = cleanEvent(event);

    const { pico, channel } = this.db.lookupChannel(event.eci);
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

    const { pico, channel } = this.db.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);
    channel.assertQueryPolicy(query, fromPicoId);

    return pico.eventQuery(event, query);
  }

  async query(query: PicoQuery, fromPicoId?: string): Promise<any> {
    query = cleanQuery(query);
    const { pico, channel } = this.db.lookupChannel(query.eci);
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
}
