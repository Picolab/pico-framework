import { Channel, ChannelConfig, ChannelReadOnly } from "./Channel";
import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from "./PicoFramework";
import { PicoQuery } from "./PicoQuery";
import { RulesetConfig, RulesetInstance } from "./Ruleset";
import { createRulesetContext } from "./RulesetContext";

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

export interface PicoReadOnly {
  /**
   * The pico's parent ECI
   * This is null for the root pico.
   */
  parent: string | null;

  /**
   * List of ECIs to the pico's children
   */
  children: string[];

  /**
   * List of the pico's channels
   */
  channels: ChannelReadOnly[];

  /**
   * Rulesets installed on the pico
   */
  rulesets: PicoRulesetReadOnly[];
}

export interface PicoRulesetReadOnly {
  rid: string;
  version: string;
  config: RulesetConfig;
}

export interface NewPicoRuleset {
  rid: string;
  version: string;
  config?: RulesetConfig;
}

export interface NewPicoConfig {
  rulesets?: NewPicoRuleset[];
}

export class Pico {
  id: string;
  parent: string | null = null;
  children: string[] = [];

  // TODO use flumelog-offset or similar
  private txnLog: PicoTxn[] = [];
  private txnWaiters: {
    [id: string]: { resolve: (data: any) => void; reject: (err: any) => void };
  } = {};

  private rulesets: {
    [rid: string]: {
      version: string;
      instance: RulesetInstance;
      config: RulesetConfig;
    };
  } = {};

  constructor(private pf: PicoFramework) {
    this.id = pf.genID();
  }

  async event(event: PicoEvent): Promise<string> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    setTimeout(() => this.doWork(), 0);
    return eid;
  }

  async eventWait(event: PicoEvent): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    const p = this.waitFor(eid);
    setTimeout(() => this.doWork(), 0);
    return p;
  }

  async eventQuery(event: PicoEvent, query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    const eidQ = eid + ".q";
    this.txnLog.push({
      id: eidQ,
      kind: "query",
      query
    });
    const p0 = this.waitFor(eid);
    const p1 = this.waitFor(eidQ);
    setTimeout(() => this.doWork(), 0);
    await p0; // this may throwup
    return p1;
  }

  async query(query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "query",
      query
    });
    setTimeout(() => this.doWork(), 0);
    return this.waitFor(eid);
  }

  async newPico(conf?: NewPicoConfig) {
    const child = new Pico(this.pf);
    this.pf.db.addPico(child);

    const parentChannel = await this.newChannel(
      { tags: ["system", "parent"] },
      child.id
    );
    const childChannel = await child.newChannel(
      { tags: ["system", "child"] },
      this.id
    );

    child.parent = parentChannel.id;

    this.children.push(childChannel.id);

    if (conf && conf.rulesets) {
      for (const rs of conf.rulesets) {
        await child.install(rs.rid, rs.version, rs.config);
      }
    }

    return child;
  }

  async delPico(eci: string) {
    if (this.children.indexOf(eci) < 0) {
      throw new Error(`delPico(${eci}) - not found in children ECIs`);
    }

    const { pico } = this.pf.db.lookupChannel(eci);

    for (const grandChild of pico.children) {
      // recursive delete
      await pico.delPico(grandChild);
    }
    this.children = this.children.filter(c => c !== eci);
    this.pf.db.removePico(pico.id);
  }

  toReadOnly(): PicoReadOnly {
    const data: PicoReadOnly = {
      parent: this.parent,
      children: this.children.slice(0),
      channels: this.pf.db.getMyChannels(this.id).map(c => c.toReadOnly()),
      rulesets: []
    };
    for (const rid of Object.keys(this.rulesets)) {
      data.rulesets.push({
        rid,
        version: this.rulesets[rid].version,
        config: this.rulesets[rid].config
      });
    }
    return Object.freeze(data);
  }

  newChannel(
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ): Promise<Channel> {
    return this.pf.db.addChannel(this.id, conf, familyChannelPicoID);
  }

  async putChannel(eci: string, conf: ChannelConfig): Promise<Channel> {
    const chann = await this.pf.db.getMyChannel(this.id, eci);
    chann.update(conf);
    return chann;
  }

  async delChannel(eci: string): Promise<void> {
    const chann = await this.pf.db.getMyChannel(this.id, eci);
    if (chann.familyChannelPicoID) {
      throw new Error("Cannot delete family channels.");
    }
    await this.pf.db.delChannel(eci);
  }

  async install(rid: string, version: string, config: RulesetConfig = {}) {
    const rs = this.pf.getRuleset(rid, version);

    if (this.rulesets[rid]) {
      if (this.rulesets[rid].version === version) {
        // already have it
        // but we need to init again b/c configure may have changed
      } else {
        // old version
      }
    }
    this.rulesets[rid] = {
      version,
      instance: rs.init(
        createRulesetContext(this.pf, this, { rid, version, config })
      ),
      config
    };
  }

  async uninstall(rid: string) {
    delete this.rulesets[rid];
  }

  private assertRid(rid: string) {
    if (!this.rulesets[rid]) {
      throw new Error(`Not installed ${rid}`);
    }
  }

  getEnt(rid: string, name: string) {
    this.assertRid(rid);
    return this.pf.db.getEnt(this.id, rid, name);
  }
  putEnt(rid: string, name: string, value: any) {
    this.assertRid(rid);
    return this.pf.db.putEnt(this.id, rid, name, value);
  }
  delEnt(rid: string, name: string) {
    this.assertRid(rid);
    return this.pf.db.delEnt(this.id, rid, name);
  }

  waitFor(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.txnWaiters[id] = { resolve, reject };
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
      let data;
      let error;
      try {
        data = await this.doTxn(txn);
      } catch (err) {
        error = err;
      }
      if (this.txnWaiters[txn.id]) {
        if (error) {
          this.txnWaiters[txn.id].reject(error);
        } else {
          this.txnWaiters[txn.id].resolve(data);
        }
        delete this.txnWaiters[txn.id];
      }
    }
    this.txnWaiters = {};
    this.isWorking = false;
  }

  private schedule: PicoEvent[] = [];

  raiseEvent(domain: string, name: string, data: PicoEventPayload) {
    this.schedule.push({
      eci: "[raise]",
      domain,
      name,
      data,
      time: Date.now()
    });
  }

  private async doTxn(txn: PicoTxn): Promise<any> {
    switch (txn.kind) {
      case "event":
        this.schedule = []; // reset schedule every new event
        this.schedule.push(txn.event);
        let event: PicoEvent | undefined;
        while ((event = this.schedule.shift())) {
          for (const rid of Object.keys(this.rulesets)) {
            const rs = this.rulesets[rid];
            if (rs.instance.event) {
              // must process one event at a time to maintain pico single-threadedness
              await rs.instance.event(event);
            }
          }
        }
        return;
      case "query":
        const rs = this.rulesets[txn.query.rid];
        if (!rs) {
          throw new Error(`Pico doesn't have ${txn.query.rid} installed.`);
        }
        const qfn = rs.instance.query && rs.instance.query[txn.query.name];
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
