import test from "ava";
import { PicoFramework } from "../src";
import { rulesetRegistry } from "./helpers/rulesetRegistry";

test("query error", async function(t) {
  const rsReg = rulesetRegistry();
  const pf = new PicoFramework({ rulesetLoader: rsReg.loader });
  rsReg.add({
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
  await pico.install(rsReg.get("rid.A", "draft"));

  const channel = await pico.newChannel({
    eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
    queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] }
  });

  let err = await t.throwsAsync(
    pf.query({ eci: channel.id, rid: "rid.A", name: "error", args: {} })
  );
  t.is(err + "", "TypeError: ctx.notAFunction is not a function");
});
