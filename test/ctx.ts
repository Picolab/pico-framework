import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.newPico", async function(t) {
  const { pf, event, query } = await mkCtxTestEnv();

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

test("ctx.delPico", async function(t) {
  const { pf, event, query } = await mkCtxTestEnv();
  await event("newPico", [
    { rulesets: [{ rid: "rid.ctx", version: "0.0.0" }] }
  ]);
  let me = await query("pico");
  t.deepEqual(me.children, ["id5"]);

  // grand children
  await event("eventQuery", [
    { eci: "id5", domain: "ctx", name: "newPico" },
    { eci: "id5", rid: "rid.ctx", name: "pico" }
  ]);
  await event("eventQuery", [
    { eci: "id5", domain: "ctx", name: "newPico" },
    { eci: "id5", rid: "rid.ctx", name: "pico" }
  ]);

  let err = await t.throwsAsync(event("delPico"));
  t.is(err + "", "Error: delPico(undefined) - not found in children ECIs");

  err = await t.throwsAsync(event("delPico", ["one"]));
  t.is(err + "", "Error: delPico(one) - not found in children ECIs");

  const allECIs = pf.picos.reduce(
    (ids: string[], p) => ids.concat(p.channels.map(c => c.id)),
    []
  );
  for (const eci of allECIs) {
    if (eci !== "id5") {
      // id5 is the only one that will delete a pico from the root
      err = await t.throwsAsync(event("delPico", [eci]));
      t.is(err + "", `Error: delPico(${eci}) - not found in children ECIs`);
    }
  }
  t.is(
    pf.picos.map(p => p.id).join(","),
    "id0,id3,id9,id14",
    "root -> child -> grandchild,grandchild"
  );
  await event("delPico", ["id5"]);
  t.is(pf.picos.map(p => p.id).join(","), "id0", "only root pico now");
});
