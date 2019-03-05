import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.uninstall", async function(t) {
  const { pf, eci, event } = await mkCtxTestEnv();

  let resp = await event("uninstall", []);
  t.is(resp, undefined);

  await pf.eventWait({
    eci,
    domain: "ctx",
    name: "uninstall",
    data: { attrs: { args: ["rid.ctx"] } },
    time: Date.now()
  });

  let err = await t.throwsAsync(
    pf.query({
      eci,
      rid: "rid.ctx",
      name: "_lastResult",
      args: {}
    })
  );
  t.is(err + "", "Error: Pico doesn't have rid.ctx installed.");
});
