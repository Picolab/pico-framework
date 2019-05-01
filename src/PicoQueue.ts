import { PicoEvent } from "./PicoEvent";
import { PicoQuery } from "./PicoQuery";

export interface PicoTxn_base {
  id: string;
}
export interface PicoTxn_event extends PicoTxn_base {
  kind: "event";
  event: PicoEvent;
}
export interface PicoTxn_query extends PicoTxn_base {
  kind: "query";
  query: PicoQuery;
}
export type PicoTxn = PicoTxn_event | PicoTxn_query;

export class PicoQueue {
  // TODO use flumelog-offset or similar
  private txnLog: PicoTxn[] = [];
  private txnWaiters: {
    [id: string]: { resolve: (data: any) => void; reject: (err: any) => void };
  } = {};

  constructor(private worker: (txn: PicoTxn) => Promise<any>) {}

  push(txn: PicoTxn) {
    this.txnLog.push(txn);
    setTimeout(() => this.doWork(), 0);
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
        data = await this.worker(txn);
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
}
