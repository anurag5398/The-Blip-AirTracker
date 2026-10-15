import { rarityOf, type Rarity } from '../../shared/aircraft';

export const PACK_SIZE = 3;
const WEIGHT: Record<Rarity, number> = { common: 1, rare: 4, epic: 9, legendary: 20 };

interface Pullable {
  hex: string;
  type: string | null;
  category: string | null;
}

/**
 * A pack is three real aircraft pulled from the live sky, weighted toward rarer ones, without repeats.
 * `pool` should already exclude anything you've caught.
 */
export function pullPack<T extends Pullable>(pool: T[], rand: () => number = Math.random): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < PACK_SIZE && remaining.length > 0) {
    const weights = remaining.map((p) => WEIGHT[rarityOf(p.type, p.category)]);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rand() * total;
    let index = 0;
    while (index < remaining.length - 1 && roll >= weights[index]) {
      roll -= weights[index];
      index++;
    }
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}
