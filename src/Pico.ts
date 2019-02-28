import * as _ from "lodash";
import { Channel, ChannelConfig, ChannelReadOnly } from "./Channel";
import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from "./PicoFramework";
import { PicoQuery } from "./PicoQuery";
import { RulesetConfig, RulesetInstance } from "./Ruleset";
import { createRulesetContext } from "./RulesetContext";
import { isNullish } from "./utils";

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
  parentChannel: Channel | null = null;
  channels: Channel[] = [];
  children: { pico: Pico; channel: Channel }[] = [];

  // TODO use flumelog-offset or similar
  private txnLog: PicoTxn[] = [];
  private txnWaiters: {
    [id: string]: { resolve: (data: any) => void; reject: (err: any) => void };
  } = {};

  rulesets: {
    [rid: string]: {
      version: string;
      instance: RulesetInstance;
      config: RulesetConfig;
      ent: { [name: string]: any };
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
    this.pf.picos.push(child);

    child.parentChannel = await this.newChannel(
      { tags: ["system", "parent"] },
      child.id
    );
    this.children.push({
      pico: child,
      channel: await child.newChannel({ tags: ["system", "child"] }, this.id)
    });
    if (conf && conf.rulesets) {
      for (const rs of conf.rulesets) {
        child.install(rs.rid, rs.version, rs.config);
      }
    }

    return child;
  }

  async delPico(eci: string) {
    const child = this.children.find(c => c.channel.id === eci);
    if (!child) {
      throw new Error(`delPico(${eci}) - not found in children ECIs`);
    }
    for (const grandChild of child.pico.children) {
      // recursive delete
      await child.pico.delPico(grandChild.channel.id);
    }
    this.children = this.children.filter(c => c.channel.id !== eci);
    this.pf.picos = this.pf.picos.filter(p => p.id !== child.pico.id);
  }

  toReadOnly(): PicoReadOnly {
    const data: PicoReadOnly = {
      parent: this.parentChannel ? this.parentChannel.id : null,
      children: this.children.map(c => c.channel.id),
      channels: this.channels.map(c => c.toReadOnly()),
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

  async newChannel(
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ): Promise<Channel> {
    const chann = new Channel(this.pf.genID(), conf, familyChannelPicoID);
    this.channels.push(chann);
    return chann;
  }

  async putChannel(eci: string, conf: ChannelConfig): Promise<Channel> {
    const chann = this.channels.find(c => c.id === eci);
    if (!chann) {
      throw new Error(`putChannel(${eci} , ...) - not found`);
    }
    chann.update(conf);
    return chann;
  }

  async delChannel(eci: string): Promise<void> {
    const chann = this.channels.find(c => c.id === eci);
    if (!chann) {
      throw new Error(`delChannel(${eci}) - not found`);
    }
    this.channels = this.channels.filter(c => c.id !== eci);
  }

  async install(rid: string, version: string, config: RulesetConfig = {}) {
    for (const rs of this.pf.rulesets) {
      if (rs.rid === rid && rs.version === version) {
        let ent = {};
        if (this.rulesets[rid]) {
          ent = this.rulesets[rid].ent;
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
          config,
          ent
        };
      }
    }
  }

  async uninstall(rid: string) {
    delete this.rulesets[rid];
  }

  private assertRid(rid: string) {
    if (!this.rulesets[rid]) {
      throw new Error(`Not installed ${rid}`);
    }
  }

  async getEnt(rid: string, name: string) {
    this.assertRid(rid);
    return this.rulesets[rid].ent[name];
  }
  async putEnt(rid: string, name: string, value: any) {
    this.assertRid(rid);
    this.rulesets[rid].ent[name] = value;
  }
  async delEnt(rid: string, name: string) {
    this.assertRid(rid);
    delete this.rulesets[rid].ent[name];
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
    // log is empty, so cleanup any dangling waiters
    for (const id of Object.keys(this.txnWaiters)) {
      this.txnWaiters[id].resolve(null);
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
