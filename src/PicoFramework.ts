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
  private rootPicoID?: string;
  rulesets: Ruleset[] = [];

  constructor(leveldown: AbstractLevelDOWN) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );
  }

  async send(event: PicoEvent, query?: PicoQuery): Promise<string | any> {
    event = cleanEvent(event);
    if (query) {
      query = cleanQuery(query);
      if (query.eci !== event.eci) {
        throw new Error("Send event+query must use the same channel");
      }
    } else {
      query = undefined; // ensure it's undefined, not just falsey
    }
    const { pico, channel } = await this.lookupChannel(event.eci);
    channel.assertEventPolicy(event);
    if (query) {
      channel.assertQueryPolicy(query);
    }
    return pico.send(event, query);
  }

  async query(query: PicoQuery): Promise<any> {
    query = cleanQuery(query);
    const { pico, channel } = await this.lookupChannel(query.eci);
    channel.assertQueryPolicy(query);
    return pico.query(query);
  }

  newPico(parentId?: string): Pico {
    if (parentId) {
      // TODO
    }
    const pico = new Pico(this);
    this.picos.push(pico);
    return pico;
  }

  private async lookupChannel(
    eci: string
  ): Promise<{ pico: Pico; channel: Channel }> {
    for (const pico of this.picos) {
      for (const channel of pico.channels) {
        if (channel.id === eci) {
          return { pico, channel };
        }
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  addRuleset(rs: Ruleset) {
    this.rulesets.push(rs);
  }
}
