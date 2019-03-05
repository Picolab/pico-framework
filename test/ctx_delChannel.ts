import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.delChannel", async function(t) {
  const { event } = await mkCtxTestEnv();

  let sub = await event("newPico", [
    { rulesets: [{ rid: "rid.ctx", version: "0.0.0" }] }
  ]);
  t.deepEqual(sub.channels.map((c: any) => c.id), ["id5"]);

  sub = await event("eventQuery", [
    { eci: "id5", domain: "ctx", name: "newChannel" },
    { eci: "id5", rid: "rid.ctx", name: "pico" }
  ]);

  t.deepEqual(sub.channels.map((c: any) => c.id), ["id5", "id8"]);

  let err = await t.throwsAsync(event("delChannel", ["id4"]));
  t.is(err + "", "Error: Cannot delete family channels.");

  err = await t.throwsAsync(event("delChannel", ["id8"]));
  t.is(err + "", "Error: delChannel(id8) - not found");

  function eventOnSub(name: string, args: any[] = []) {
    return event("eventQuery", [
      { eci: "id5", domain: "ctx", name, data: { attrs: { args } } },
      { eci: "id5", rid: "rid.ctx", name: "_lastResult" }
    ]);
  }

  err = await t.throwsAsync(eventOnSub("delChannel", ["id5"]));
  t.is(err + "", "Error: Cannot delete family channels.");

  t.is(await eventOnSub("delChannel", ["id8"]), undefined);

  err = await t.throwsAsync(eventOnSub("delChannel", ["id8"]));
  t.is(err + "", "Error: delChannel(id8) - not found");

  sub = await event("query", [{ eci: "id5", rid: "rid.ctx", name: "pico" }]);
  t.deepEqual(sub.channels.map((c: any) => c.id), ["id5"]);
});
