import { RulesetConfig } from ".";
import { PicoTxn } from "./PicoQueue";

export type PicoFrameworkEvent =
  | PicoFrameworkEvent_startup
  | PicoFrameworkEvent_startupDone
  | PicoFrameworkEvent_txnQueued
  | PicoFrameworkEvent_txnStart
  | PicoFrameworkEvent_txnDone
  | PicoFrameworkEvent_txnError
  | PicoFrameworkEvent_reInitRulesetError;

export interface PicoFrameworkEvent_startup {
  type: "startup";
}

export interface PicoFrameworkEvent_startupDone {
  type: "startupDone";
}

export interface PicoFrameworkEvent_txnQueued {
  type: "txnQueued";
  picoId: string;
  txn: PicoTxn;
}

export interface PicoFrameworkEvent_txnStart {
  type: "txnStart";
  picoId: string;
  txn: PicoTxn;
}

export interface PicoFrameworkEvent_txnDone {
  type: "txnDone";
  picoId: string;
  txn: PicoTxn;
  data: any;
}

export interface PicoFrameworkEvent_txnError {
  type: "txnError";
  picoId: string;
  txn: PicoTxn;
  error: any;
}

export interface PicoFrameworkEvent_reInitRulesetError {
  type: "reInitRulesetError";
  picoId: string;
  rid: string;
  version: string;
  config?: RulesetConfig;
}
