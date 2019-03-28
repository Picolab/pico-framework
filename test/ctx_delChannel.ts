import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.delChannel", async function(t) {
  const { event } = await mkCtxTestEnv();

  let subECI = await event("newPico", [
    { rulesets: [{ rid: "rid.ctx", version: "0.0.0" }] }
  ]);
  let sub = await await event("query", [
    { eci: subECI, rid: "rid.ctx", name: "pico" }
  ]);
  t.deepEqual(sub.channels.map((c: any) => c.id), ["id5"]);

  sub = await event("eventQuery", [
    { eci: "id5", domain: "ctx", name: "newChannel" },
    { eci: "id5", rid: "rid.ctx", name: "pico" }
  ]);

  t.deepEqual(sub.channels.map((c: any) => c.id), ["id10", "id5"]);
  const otherChannel = "id10";

  let err = await t.throwsAsync(event("delChannel", ["id4"]));
  t.is(err + "", "Error: Cannot delete family channels.");

  err = await t.throwsAsync(event("delChannel", [otherChannel]));
  t.is(err + "", `Error: ECI not found ${otherChannel}`);

  function eventOnSub(name: string, args: any[] = []) {
    return event("eventQuery", [
      { eci: "id5", domain: "ctx", name, data: { attrs: { args } } },
      { eci: "id5", rid: "rid.ctx", name: "_lastResult" }
    ]);
  }

  err = await t.throwsAsync(eventOnSub("delChannel", ["id5"]));
  t.is(err + "", "Error: Cannot delete family channels.");

  t.is(await eventOnSub("delChannel", [otherChannel]), undefined);

  err = await t.throwsAsync(eventOnSub("delChannel", [otherChannel]));
  t.is(err + "", `Error: ECI not found ${otherChannel}`);

  sub = await event("query", [{ eci: "id5", rid: "rid.ctx", name: "pico" }]);
  t.deepEqual(sub.channels.map((c: any) => c.id), ["id5"]);
});
