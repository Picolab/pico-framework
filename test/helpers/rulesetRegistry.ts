import { Ruleset, RulesetLoader } from "../../src";

export function rulesetRegistry() {
  let rulesets: Ruleset[] = [];

  function add(rs: Ruleset) {
    rulesets = rulesets.filter(
      r => !(r.rid === rs.rid && r.version === rs.version)
    );
    rulesets.push(rs);
  }

  function get(rid: string, version: string) {
    for (const rs of rulesets) {
      if (rs.rid === rid && rs.version === version) {
        return rs;
      }
    }
    throw new Error(`Ruleset not found: ${rid}@${version}`);
  }

  const loader: RulesetLoader = (
    picoId: string,
    rid: string,
    version: string,
    config: any
  ) => {
    return get(rid, version);
  };

  return { add, get, loader };
}
