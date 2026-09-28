import test from "node:test";
import assert from "node:assert/strict";
import { VocabDashTermsSchema } from "../src/lib/vocab-dash-schema.ts";

test("accepts generated vocabulary with empty or omitted alternate meanings", () => {
  const result = VocabDashTermsSchema.parse({ terms: [
    { word: "observe", definition: "To watch carefully.", alternateDefinition: "" },
    { word: "compare", definition: "To find similarities and differences." },
    { word: "bank", definition: "The land beside a river.", alternateDefinition: "A place to keep money." }
  ] });
  assert.deepEqual(result.terms.map((term) => term.alternateDefinition), ["", "", "A place to keep money."]);
});

test("still rejects generated words without a usable primary definition", () => {
  for (const definition of ["", "   ", undefined]) {
    assert.equal(VocabDashTermsSchema.safeParse({terms:[{word:"observe",definition,alternateDefinition:""}]}).success,false);
  }
});
