import { Event } from "select-when";

export interface PicoEventPayload {
  attrs: { [name: string]: any };
}

export interface PicoEvent extends Event<PicoEventPayload> {
  eci: string;
}
