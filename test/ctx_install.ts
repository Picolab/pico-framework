import test from "ava";
import { RulesetInstance } from "../src/Ruleset";
import { mkCtxTestEnv } from "./helpers/mkCtxTestEnv";

test("ctx.install", async function(t) {
  const { pf, eci, rsReg } = await mkCtxTestEnv();

  let history: string[] = [];

  rsReg.add({
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
  rsReg.add({
    rid: "foo.bar",
    version: "1.1.1",
    async init(): Promise<RulesetInstance> {
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

  let resp = await pf.rootPico.install(rsReg.get("foo.bar", "0.0.0"));
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

  resp = await pf.rootPico.install(rsReg.get("foo.bar", "1.1.1"));
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
