import assert from "node:assert/strict";
import test from "node:test";
import { cosmeticPurchase, equippedCosmetics, vocabDashAccessories } from "../src/lib/vocab-dash.ts";
import { saveCosmeticLook } from "../src/lib/cosmetic-purchase.ts";

function accountStore(stars: number) {
  const state = { stars, unlockedAccessories: "[]", selectedAccessory: null as string | null, characterColor: "blue" };
  const store = {
    async findUniqueOrThrow() { return { ...state }; },
    async updateMany(args: { where: { stars: number; unlockedAccessories: string }; data: { stars: { decrement: number }; unlockedAccessories: string; selectedAccessory: string | null; characterColor: string } }) {
      if (state.stars !== args.where.stars || state.unlockedAccessories !== args.where.unlockedAccessories) return { count: 0 };
      Object.assign(state, args.data, { stars: state.stars - args.data.stars.decrement });
      return { count: 1 };
    }
  };
  return { state, store };
}

test("legacy cosmetics still equip, and new looks support one item per slot", () => {
  assert.deepEqual(equippedCosmetics("cap"), ["cap"]);
  assert.deepEqual(equippedCosmetics('["cap","pixel-shades","bandana"]'), ["cap", "pixel-shades", "bandana"]);
  assert.deepEqual(equippedCosmetics('invalid'), []);
});
test("free items need no balance and ownership is charged only once", () => {
  assert.equal(cosmeticPurchase('["star-bow","bandana"]', [], 0).cost, 0);
  assert.equal(cosmeticPurchase('["space-crown","pixel-shades"]', ["space-crown"], 20).cost, 20);
  assert.equal(cosmeticPurchase('space-crown', ["space-crown"], 0).cost, 0);
});
test("forged or conflicting selections are rejected", () => {
  for (const value of ['["cap","beanie"]', '["free-crown"]', '["space-crown","space-crown"]', '[123]', '[broken']) {
    assert.throws(() => cosmeticPurchase(value, [], 1000));
  }
  assert.throws(() => cosmeticPurchase('space-crown', [], 59), /1 more stars/);
});
test("simultaneous duplicate purchases charge once", async () => {
  const { state, store } = accountStore(80);
  await Promise.all([saveCosmeticLook(store, "student", "pink", "space-crown"), saveCosmeticLook(store, "student", "pink", "space-crown")]);
  assert.equal(state.stars, 20);
  assert.deepEqual(JSON.parse(state.unlockedAccessories), ["space-crown"]);
});
test("simultaneous different purchases cannot overspend", async () => {
  const { state, store } = accountStore(60);
  const results = await Promise.allSettled([saveCosmeticLook(store, "student", "blue", "space-crown"), saveCosmeticLook(store, "student", "blue", "headphones")]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.ok(state.stars >= 0);
  assert.equal(JSON.parse(state.unlockedAccessories).length, 1);
});
test("rewards earned during a purchase are preserved", async () => {
  const { state, store } = accountStore(60);
  const update = store.updateMany.bind(store);
  let rewarded = false;
  store.updateMany = async (args) => { if (!rewarded) { state.stars += 5; rewarded = true; } return update(args); };
  await saveCosmeticLook(store, "student", "green", "space-crown");
  assert.equal(state.stars, 5);
});
test("catalog has unique keys and safe costs", () => {
  assert.equal(new Set(vocabDashAccessories.map((item) => item.key)).size, vocabDashAccessories.length);
  assert.ok(vocabDashAccessories.every((item) => Number.isInteger(item.cost) && item.cost >= 0));
});
