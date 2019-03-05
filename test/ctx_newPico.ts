import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.newPico", async function(t) {
  const { event, query } = await mkCtxTestEnv();

  t.deepEqual(await query("pico"), {
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
    await event("newPico", [
      { rulesets: [{ rid: "rid.ctx", version: "0.0.0" }] }
    ]),
    {
      parent: "id5",
      children: [],
      channels: [
        {
          id: "id6",
          tags: ["system", "child"],
          eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
          queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
          familyChannelPicoID: "id0"
        }
      ],
      rulesets: [{ rid: "rid.ctx", version: "0.0.0", config: {} }]
    }
  );

  t.deepEqual(await query("pico"), {
    parent: null,
    children: ["id6"],
    channels: [
      {
        id: "id1",
        tags: [],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
        familyChannelPicoID: null
      },
      {
        id: "id5",
        tags: ["system", "parent"],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
        familyChannelPicoID: "id4"
      }
    ],
    rulesets: [{ rid: "rid.ctx", version: "0.0.0", config: {} }]
  });
});
