import test from "ava";
import { PicoFramework } from "../src";
import { rulesetRegistry } from "./helpers/rulesetRegistry";

test("clearSchedule", async function(t) {
  let log: string[] = [];

  const rsReg = rulesetRegistry();

  const pf = new PicoFramework({ rulesetLoader: rsReg.loader });
  rsReg.add({
    rid: "rid.A",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          log.push(`rid.A - ${event.domain}:${event.name}`);
          if (event.name === "clear") {
            ctx.clearSchedule();
          }
        }
      };
    }
  });
  rsReg.add({
    rid: "rid.B",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          log.push(`rid.B - ${event.domain}:${event.name}`);
        }
      };
    }
  });
  await pf.start();
  const pico = pf.rootPico;
  await pico.install(rsReg.get("rid.A", "0.0.0"), {});
  await pico.install(rsReg.get("rid.B", "0.0.0"), {});
  const eci = (await pico.newChannel()).id;

  t.deepEqual(log, []);

  await pf.eventWait({ eci, domain: "a", name: "a" } as any);
  t.deepEqual(log, ["rid.A - a:a", "rid.B - a:a"]);
  log = [];

  await pf.eventWait({ eci, domain: "a", name: "clear" } as any);
  t.deepEqual(log, [
    "rid.A - a:clear"
    // NOTE: rid.B does not run
  ]);
});
