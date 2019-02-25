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

  async send(event: PicoEvent, query?: PicoQuery): Promise<string> {
    event = cleanEvent(event);
    query = query ? cleanQuery(query) : undefined;
    const { pico, channel } = this.lookupChannel(event.eci);
    // TODO policy
    const eid = await pico.send(event, query);
    // TODO event+query
    return eid;
  }

  async query(query: PicoQuery) {
    query = cleanQuery(query);
    const { pico, channel } = this.lookupChannel(query.eci);
    // TODO policy
    const data = await pico.query(query);
    return data;
  }

  newPico(parentId?: string): Pico {
    if (parentId) {
      // TODO
    }
    const pico = new Pico(this);
    this.picos.push(pico);
    return pico;
  }

  private lookupChannel(eci: string): { pico: Pico; channel: Channel } {
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
