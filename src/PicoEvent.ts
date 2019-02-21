import { Event } from "select-when";
import { PicoQuery } from "./PicoQuery";

export interface PicoEventPayload {
  attrs: { [name: string]: any };
}

export interface PicoEvent extends Event<PicoEventPayload> {
  eci: string;
  query?: PicoQuery;
}
