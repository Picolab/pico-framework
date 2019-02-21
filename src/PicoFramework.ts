import { Event } from "select-when";
import { LevelUp, default as level } from "levelup";
import { AbstractLevelDOWN, AbstractBatch } from "abstract-leveldown";
import * as cuid from "cuid";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

interface PicoEventPayload {
  attrs: { [name: string]: any };
}

interface PicoEvent extends Event<PicoEventPayload> {
  eci: string;
  query?: PicoQuery;
}

interface PicoQuery {
  eci: string;
  rid: string;
  name: string;
  args: { [key: string]: any };
}

interface PicoTxn_base {}
interface PicoTxn_event extends PicoTxn_base {
  kind: "event";
  event: PicoEvent;
}
interface PicoTxn_query extends PicoTxn_base {
  kind: "query";
  query: PicoQuery;
}
type PicoTxn = PicoTxn_event | PicoTxn_query;

class TxnLog {
  // TODO use flumelog-offset or similar
  private log: [string, PicoTxn][] = [];

  append(value: PicoTxn): string {
    const id = cuid();
    this.log.push([id, value]);
    return id;
  }

  next(): PicoTxn | null {
    const entry = this.log.shift();
    if (!entry) {
      return null;
    }
    return entry[1];
  }
}

class Channel {
  id: string = cuid();
  // TODO policy
  // TODO keys
}

class Pico {
  id: string = cuid();
  channels: Channel[] = [];
  private txnLog = new TxnLog();

  rulesets: {
    [rid: string]: { version: string; instance: RulesetInstance };
  } = {};

  constructor(private pf: PicoFramework) {}

  async send(event: PicoEvent): Promise<string> {
    const eid = this.txnLog.append({ kind: "event", event });
    // TODO wait until pico processes it
    // TODO return eid right away
    for (const rid of Object.keys(this.rulesets)) {
      const rs = this.rulesets[rid];
      rs.instance.event(event);
    }
    return eid;
  }

  async query(query: PicoQuery): Promise<any> {
    const eid = this.txnLog.append({ kind: "query", query });
    // TODO wait until pico processes it

    const rs = this.rulesets[query.rid];
    if (!rs) {
      throw new Error(`Pico doesn't have ${query.rid} installed.`);
    }
    return rs.instance.query(query.name, query.args);
  }

  newChannel(): Channel {
    const chann = new Channel();
    this.channels.push(chann);
    return chann;
  }

  installRuleset(rid: string, version: string) {
    for (const rs of this.pf.rulesets) {
      if (rs.rid === rid && rs.version === version) {
        if (this.rulesets[rid]) {
          if (this.rulesets[rid].version === version) {
            // already have it
            return;
          }
          // TODO uninstall this.rulesets[rid]
        }
        this.rulesets[rid] = {
          version,
          instance: rs.init(this.pf, this)
        };
      }
    }
  }
}

interface RulesetInstance {
  event(event: PicoEvent): void;
  query(name: string, args: { [key: string]: any }): any;
}

interface Ruleset {
  rid: string;
  version: string;
  init(pf: PicoFramework, pico: Pico): RulesetInstance;
}

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

  async send(event: PicoEvent): Promise<string> {
    // TODO clean event
    const { pico, channel } = this.lookupChannel(event.eci);
    // TODO policy
    const eid = await pico.send(event);
    // TODO event+query
    return eid;
  }

  async query(query: PicoQuery) {
    // TODO clean query
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
