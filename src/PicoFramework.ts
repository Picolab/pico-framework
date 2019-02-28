import { AbstractLevelDOWN } from "abstract-leveldown";
import { default as level, LevelUp } from "levelup";
import { Channel } from "./Channel";
import { Pico } from "./Pico";
import { PicoEvent, cleanEvent } from "./PicoEvent";
import { PicoQuery, cleanQuery } from "./PicoQuery";
import { Ruleset } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

export class PicoFramework {
  private db: LevelUp;
  // TODO use db instead of in-memory
  private picos: Pico[] = [];
  rulesets: Ruleset[] = [];
  private startupP: Promise<void>;
  private rootPico?: Pico;

  constructor(leveldown: AbstractLevelDOWN) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );

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

  async event(event: PicoEvent): Promise<string | any> {
    await this.start();
    event = cleanEvent(event);

    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event);

    return pico.event(event);
  }

  async eventQuery(event: PicoEvent, query: PicoQuery): Promise<any> {
    await this.start();
    event = cleanEvent(event);
    query = cleanQuery(query);
    if (query.eci !== event.eci) {
      throw new Error("Send event+query must use the same channel");
    }

    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event);
    channel.assertQueryPolicy(query);

    return pico.eventQuery(event, query);
  }

  async query(query: PicoQuery): Promise<any> {
    await this.start();
    query = cleanQuery(query);
    const { pico, channel } = await this.lookupChannel(query.eci);
    channel.assertQueryPolicy(query);
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
