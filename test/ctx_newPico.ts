import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.newPico", async function(t) {
  const { pf, event, query, rsReg } = await mkCtxTestEnv();

  t.deepEqual(await query("pico"), {
    id: "id0",
    parent: null,
    children: [],
    channels: [
      {
        id: "id1",
        tags: [],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
        familyChannelPicoID: null
      }
    ],
    rulesets: [{ rid: "rid.ctx", version: "0.0.0", config: {} }]
  });

  t.deepEqual(
    await pf.getPico("id1").newPico({
      rulesets: [{ rs: rsReg.get("rid.ctx", "0.0.0") }]
    }),
    "id5"
  );

  t.deepEqual(await query("pico"), {
    id: "id0",
    parent: null,
    children: ["id5"],
    channels: [
      {
        id: "id1",
        tags: [],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
        familyChannelPicoID: null
      },
      {
        id: "id4",
        tags: ["system", "parent"],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
        familyChannelPicoID: "id3"
      }
    ],
    rulesets: [{ rid: "rid.ctx", version: "0.0.0", config: {} }]
  });
});
