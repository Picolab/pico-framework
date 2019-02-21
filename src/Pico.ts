import * as cuid from "cuid";
import { PicoFramework } from "./PicoFramework";
import { PicoQuery } from "./PicoQuery";
import { PicoEvent } from "./PicoEvent";
import { Channel } from "./Channel";
import { RulesetInstance } from "./Ruleset";

interface PicoTxn_base {
  id: string;
}
interface PicoTxn_event extends PicoTxn_base {
  kind: "event";
  event: PicoEvent;
}
interface PicoTxn_query extends PicoTxn_base {
  kind: "query";
  query: PicoQuery;
}
type PicoTxn = PicoTxn_event | PicoTxn_query;

export class Pico {
  id: string = cuid();
  channels: Channel[] = [];

  // TODO use flumelog-offset or similar
  private txnLog: PicoTxn[] = [];
  private txnWaiters: {
    [id: string]: (data: any) => void;
  } = {};

  rulesets: {
    [rid: string]: {
      version: string;
      instance: RulesetInstance;
    };
  } = {};

  constructor(private pf: PicoFramework) {}

  async send(event: PicoEvent, query?: PicoQuery): Promise<string> {
    const eid = cuid();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    if (query) {
      const eidQ = eid + ".q";
      this.txnLog.push({
        id: eidQ,
        kind: "query",
        query
      });
      setTimeout(() => this.doWork(), 0);
      return this.waitFor(eidQ);
    }
    setTimeout(() => this.doWork(), 0);
    return eid;
  }

  async query(query: PicoQuery): Promise<any> {
    const eid = cuid();
    this.txnLog.push({
      id: eid,
      kind: "query",
      query
    });
    setTimeout(() => this.doWork(), 0);
    return this.waitFor(eid);
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

  waitFor(id: string): Promise<any> {
    return new Promise(resolve => {
      this.txnWaiters[id] = resolve;
    });
  }

  private isWorking = false;
  private async doWork() {
    if (this.isWorking) {
      return;
    }
    this.isWorking = true;
    let txn;
    while ((txn = this.txnLog.shift())) {
      const data = await this.doTxn(txn);
      if (this.txnWaiters[txn.id]) {
        this.txnWaiters[txn.id](data);
        delete this.txnWaiters[txn.id];
      }
    }
    // log is empty, so cleanup any dangling waiters
    for (const id of Object.keys(this.txnWaiters)) {
      this.txnWaiters[id](null);
    }
    this.txnWaiters = {};
    this.isWorking = false;
  }

  private async doTxn(txn: PicoTxn): Promise<any> {
    switch (txn.kind) {
      case "event":
        // TODO rule schedule
        // TODO ability to raise events while processing
        for (const rid of Object.keys(this.rulesets)) {
          const rs = this.rulesets[rid];
          await rs.instance.event(txn.event); // single thread
        }
        return;
      case "query":
        const rs = this.rulesets[txn.query.rid];
        if (!rs) {
          throw new Error(`Pico doesn't have ${txn.query.rid} installed.`);
        }
        const qfn = rs.instance.query[txn.query.name];
        if (!qfn) {
          throw new Error(
            `Ruleset ${txn.query.rid} does not have query function "${
              txn.query.name
            }"`
          );
        }
        const data = await qfn(txn.query.args);
        return data;
    }
  }
}
