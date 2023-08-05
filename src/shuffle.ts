export class SeededRandom {
  private seed: number;
  private callsSoFar = 0;
  private readonly originalSeed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.originalSeed = seed;
  }

  // http://indiegamr.com/generate-repeatable-random-numbers-in-js/
  next(max?: number, min?: number): number {
    this.callsSoFar++;
    max = max || 1;
    min = min || 0;

    this.seed = (this.seed * 9301 + 49297) % 233280;
    var rnd = this.seed / 233280;

    return min + rnd * (max - min);
  }

  shuffleInPlace<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  toString(): string {
    return (
      "seeded with " +
      this.originalSeed +
      ", called " +
      this.callsSoFar +
      " times so far"
    );
  }
}

// Test
// const arr = [1, 2, 3, 4, 5];
// new SeededRandom(123456).shuffleInPlace(arr);
// console.log(arr);
