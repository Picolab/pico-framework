import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.delPico", async function(t) {
  const { pf, event, query } = await mkCtxTestEnv();
  await event("newPico", [
    { rulesets: [{ rid: "rid.ctx", version: "0.0.0" }] }
  ]);
  let me = await query("pico");
  t.deepEqual(me.children, ["id5"]);

  // grand children
  await event("event", [{ eci: "id5", domain: "ctx", name: "newPico" }]);
  await event("event", [{ eci: "id5", domain: "ctx", name: "newPico" }]);

  let err = await t.throwsAsync(event("delPico"));
  t.is(err + "", "Error: delPico(undefined) - not found in children ECIs");

  err = await t.throwsAsync(event("delPico", ["one"]));
  t.is(err + "", "Error: delPico(one) - not found in children ECIs");

  const _test_allECIs = pf.db._test_allECIs();
  for (const eci of _test_allECIs) {
    if (eci !== "id5") {
      // id5 is the only one that will delete a pico from the root
      err = await t.throwsAsync(event("delPico", [eci]));
      t.is(err + "", `Error: delPico(${eci}) - not found in children ECIs`);
    }
  }
  t.is(
    pf.db._test_allPicoIDs().join(","),
    "id0,id3,id10,id14",
    "root -> child -> grandchild,grandchild"
  );
  await event("delPico", ["id5"]);
  t.is(pf.db._test_allPicoIDs().join(","), "id0", "only root pico now");
});
