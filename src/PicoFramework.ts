import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel } from "./Channel";
import { Pico } from "./Pico";
import { cleanEvent, PicoEvent } from "./PicoEvent";
import { cleanQuery, PicoQuery } from "./PicoQuery";
import { Ruleset } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

export class PicoFramework {
  private db: LevelUp;
  // TODO use db instead of in-memory
  picos: Pico[] = [];
  rulesets: Ruleset[] = [];
  private startupP: Promise<void>;
  private rootPico?: Pico;
  genID: () => string;

  constructor(leveldown: AbstractLevelDOWN, genID: () => string = cuid) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );
    this.genID = genID;

    this.startupP = (async () => {
      if (!this.rootPico) {
        this.rootPico = new Pico(this);
        this.picos.push(this.rootPico);
      }
    })();
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
    await this.start();
    event = cleanEvent(event);

    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return pico.event(event);
  }

  async eventWait(
    event: PicoEvent,
    fromPicoId?: string
  ): Promise<string | any> {
    await this.start();
    event = cleanEvent(event);

    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);

    return pico.eventWait(event);
  }

  async eventQuery(
    event: PicoEvent,
    query: PicoQuery,
    fromPicoId?: string
  ): Promise<any> {
    await this.start();
    event = cleanEvent(event);
    query = cleanQuery(query);
    if (query.eci !== event.eci) {
      throw new Error("Send event+query must use the same channel");
    }

    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event, fromPicoId);
    channel.assertQueryPolicy(query, fromPicoId);

    return pico.eventQuery(event, query);
  }

  async query(query: PicoQuery, fromPicoId?: string): Promise<any> {
    await this.start();
    query = cleanQuery(query);
    const { pico, channel } = await this.lookupChannel(query.eci);
    channel.assertQueryPolicy(query, fromPicoId);
    return pico.query(query);
  }

  async lookupChannel(eci: string): Promise<{ pico: Pico; channel: Channel }> {
    await this.start();
    for (const pico of this.picos) {
      for (const channel of pico.channels) {
        if (channel.id === eci) {
          return { pico, channel };
        }
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  async addRuleset(rs: Ruleset) {
    await this.start();
    this.rulesets.push(rs);
  }
}
