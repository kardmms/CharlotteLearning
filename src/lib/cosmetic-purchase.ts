import { cosmeticPurchase, ownedCosmetics, vocabDashColors } from "./vocab-dash.ts";

type AccountSnapshot = { stars: number; unlockedAccessories: string };
type CosmeticAccountStore = {
  findUniqueOrThrow(args: { where: { id: string }; select: { stars: true; unlockedAccessories: true } }): Promise<AccountSnapshot>;
  updateMany(args: {
    where: { id: string; stars: number; unlockedAccessories: string };
    data: { stars: { decrement: number }; characterColor: string; unlockedAccessories: string; selectedAccessory: string | null };
  }): Promise<{ count: number }>;
};

export async function saveCosmeticLook(store: CosmeticAccountStore, accountId: string, color: string, requested: string) {
  if (!vocabDashColors.some((item) => item.key === color)) throw new Error("Choose an available character color.");
  // Compare-and-swap preserves concurrent star rewards and serializes purchases.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.findUniqueOrThrow({ where: { id: accountId }, select: { stars: true, unlockedAccessories: true } });
    const purchase = cosmeticPurchase(requested, ownedCosmetics(current.unlockedAccessories), current.stars);
    const saved = await store.updateMany({
      where: { id: accountId, stars: current.stars, unlockedAccessories: current.unlockedAccessories },
      data: {
        stars: { decrement: purchase.cost },
        characterColor: color,
        unlockedAccessories: JSON.stringify(purchase.owned),
        selectedAccessory: purchase.keys.length ? JSON.stringify(purchase.keys) : null
      }
    });
    if (saved.count === 1) return purchase;
  }
  throw new Error("Your stars just changed. Please try saving your look again.");
}
