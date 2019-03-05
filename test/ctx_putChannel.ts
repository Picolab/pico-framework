import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.putChannel", async function(t) {
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

  let chann = await event("putChannel", [
    "id4",
    {
      tags: ["try-to-change", null],
      eventPolicy: { not: "checked" },
      queryPolicy: { not: "checked" }
    }
  ]);
  t.deepEqual(
    chann.tags,
    ["system", "parent"],
    "cannot change family channels"
  );

  let err = await t.throwsAsync(
    event("putChannel", ["id8", { tags: ["new", "tags"] }])
  );
  t.is(
    err + "",
    "Error: putChannel(id8 , ...) - not found",
    "cannot edit anothers channels"
  );

  function eventOnSub(name: string, args: any[] = []) {
    return event("eventQuery", [
      { eci: "id5", domain: "ctx", name, data: { attrs: { args } } },
      { eci: "id5", rid: "rid.ctx", name: "_lastResult" }
    ]);
  }

  chann = await eventOnSub("putChannel", ["id8", { tags: ["new", "tags"] }]);
  t.is(chann.tags.join(","), "new,tags");
  chann = await eventOnSub("putChannel", [
    "id8",
    { tags: ["changed", "again"] }
  ]);
  t.is(chann.tags.join(","), "changed,again");

  err = await t.throwsAsync(
    eventOnSub("putChannel", [
      "id8",
      { eventPolicy: { allow: [], deny: [{ not: "an", event: "rule" }] } }
    ])
  );
  t.is(
    err + "",
    "TypeError: EventPolicyRule expects {domain: string, name: string}"
  );

  err = await t.throwsAsync(
    eventOnSub("putChannel", [
      "id8",
      { queryPolicy: { allow: [], deny: [{ not: "a", query: "rule" }] } }
    ])
  );
  t.is(
    err + "",
    "TypeError: QueryPolicyRule expects {rid: string, name: string}"
  );

  err = await t.throwsAsync(eventOnSub("putChannel", ["id8", { tags: "wat" }]));
  t.is(
    err + "",
    "TypeError: Channel `tags` must be an array of non-empty strings."
  );

  err = await t.throwsAsync(eventOnSub("putChannel", ["id8", { tags: [1] }]));
  t.is(
    err + "",
    "TypeError: Channel `tags` must be an array of non-empty strings."
  );

  err = await t.throwsAsync(
    eventOnSub("putChannel", ["id8", { tags: ["\t\n "] }])
  );
  t.is(err + "", "TypeError: Channel tag cannot be a blank string.");

  err = await t.throwsAsync(
    eventOnSub("putChannel", ["id8", { tags: ["system"] }])
  );
  t.is(err + "", 'TypeError: Cannot tag channel as "system".');

  chann = await eventOnSub("putChannel", ["id8", { tags: [] }]);
  t.is(chann.tags.join(","), "", "tags can be empty");

  chann = await eventOnSub("putChannel", [
    "id8",
    { tags: ["  Foo--bar_baz 123 ", " -- some-\t-- thing Else?\nI think."] }
  ]);
  t.is(
    chann.tags.join(","),
    "foo-bar_baz-123,some-thing-else-i-think",
    "slugify channel tags"
  );
});
