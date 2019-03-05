import * as _ from "lodash";
import test from "ava";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.install", async function(t) {
  const { pf, eci, event } = await mkCtxTestEnv();

  let history: string[] = [];

  pf.addRuleset({
    rid: "foo.bar",
    version: "0.0.0",
    init() {
      return {
        event(event) {
          history.push(`foo.bar@0.0.0 ${event.domain}:${event.name}`);
        },
        query: {
          msg() {
            return "zero zero zero";
          }
        }
      };
    }
  });
  pf.addRuleset({
    rid: "foo.bar",
    version: "1.1.1",
    init() {
      return {
        event(event) {
          history.push(`foo.bar@1.1.1 ${event.domain}:${event.name}`);
        },
        query: {
          msg() {
            return "one one one";
          }
        }
      };
    }
  });

  await pf.eventWait({
    eci,
    domain: "foo",
    name: "bar",
    data: { attrs: {} },
    time: 0
  });
  t.deepEqual(history, []);

  let err = await t.throwsAsync(event("install", []));
  t.is(err + "", "Error: Ruleset not found undefined@undefined");

  err = await t.throwsAsync(event("install", ["foo", "0.0.0"]));
  t.is(err + "", "Error: Ruleset not found foo@0.0.0");

  err = await t.throwsAsync(event("install", ["foo.bar", "1.0.0"]));
  t.is(err + "", "Error: Ruleset version not found foo.bar@1.0.0");

  let resp = await event("install", ["foo.bar", "0.0.0"]);
  t.is(resp, undefined);

  await pf.eventWait({
    eci,
    domain: "some",
    name: "thing",
    data: { attrs: {} },
    time: 0
  });
  t.deepEqual(history, [`foo.bar@0.0.0 some:thing`]);
  t.deepEqual(
    await pf.query({ eci, rid: "foo.bar", name: "msg", args: {} }),
    "zero zero zero"
  );

  resp = await event("install", ["foo.bar", "1.1.1"]);
  t.is(resp, undefined);
  history = [];

  await pf.eventWait({
    eci,
    domain: "some",
    name: "other",
    data: { attrs: {} },
    time: 0
  });
  t.deepEqual(history, [`foo.bar@1.1.1 some:other`]);
  history = [];
  t.deepEqual(
    await pf.query({ eci, rid: "foo.bar", name: "msg", args: {} }),
    "one one one"
  );
});
