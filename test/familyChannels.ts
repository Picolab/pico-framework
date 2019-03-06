import * as _ from "lodash";
import test from "ava";
import { testPicoFramework } from "./helpers/testPicoFramework";
import { PicoEvent } from "../src/PicoEvent";
import { PicoQuery } from "../src/PicoQuery";

test("ctx.newChannel", async function(t) {
  const { pf } = await testPicoFramework([
    { rid: "foo", version: "0.0.0", init: () => ({ query: { b() {} } }) }
  ]);

  const pico = await pf.getRootPico();
  const subPico = await pico.newPico({
    rulesets: [{ rid: "foo", version: "0.0.0" }]
  });

  const eciToChild = pico.children[0];

  function mkEv(eci: string): PicoEvent {
    return { eci, domain: "a", name: "b", data: { attrs: {} }, time: 0 };
  }
  function mkQr(eci: string): PicoQuery {
    return { eci, rid: "foo", name: "b", args: {} };
  }

  let err = await t.throwsAsync(pf.event(mkEv(eciToChild)));
  t.is(
    err + "",
    "Error: This is a family channel and only the owner can use it."
  );
  err = await t.throwsAsync(pf.event(mkEv(eciToChild), subPico.id));
  t.is(
    err + "",
    "Error: This is a family channel and only the owner can use it."
  );
  await t.notThrowsAsync(pf.event(mkEv(eciToChild), pico.id));

  err = await t.throwsAsync(pf.query(mkQr(eciToChild)));
  t.is(
    err + "",
    "Error: This is a family channel and only the owner can use it."
  );
  err = await t.throwsAsync(pf.query(mkQr(eciToChild), subPico.id));
  t.is(
    err + "",
    "Error: This is a family channel and only the owner can use it."
  );
  await t.notThrowsAsync(pf.query(mkQr(eciToChild), pico.id));
});
