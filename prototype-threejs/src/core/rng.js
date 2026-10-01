// 시드 고정 난수 (mulberry32). 상태를 숫자 하나로 저장할 수 있어 재현·저장이 쉽다.
// Godot 이식: RandomNumberGenerator(seed, state)로 대체.

export class Rng {
  constructor(seed = 1) { this.state = seed >>> 0; }

  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }

  pickWeighted(items, weightOf) {
    const total = items.reduce((s, it) => s + Math.max(0, weightOf(it)), 0);
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weightOf(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}
