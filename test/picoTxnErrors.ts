import test from "ava";
import { PicoFramework, Ruleset } from "../src";

test("query error", async function(t) {
  const pf = new PicoFramework();
  pf.addRuleset({
    rid: "rid.A",
    version: "draft",
    init(ctx) {
      return {
        query: {
          error() {
            (ctx as any).notAFunction();
          }
        }
      };
    }
  });
  await pf.start();
  const pico = await pf.rootPico;
  await pico.install("rid.A", "draft");

  const channel = await pico.newChannel({
    eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
    queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] }
  });

  let err = await t.throwsAsync(
    pf.query({ eci: channel.id, rid: "rid.A", name: "error", args: {} })
  );
  t.is(err + "", "TypeError: ctx.notAFunction is not a function");
});
