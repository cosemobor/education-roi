/** Hand-checkable cases for src/lib/roi.ts. Run: npx tsx scripts/check-roi.ts (exit 1 on failure). */
import { computeRoi, earningsPath, REAL_DISCOUNT_RATE } from '../src/lib/roi';
const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
ok(Math.abs(REAL_DISCOUNT_RATE - 0.0531) < 0.0002, `real rate ${(REAL_DISCOUNT_RATE*100).toFixed(2)}%`);
ok(JSON.stringify(earningsPath(10, 70)) === JSON.stringify([10,20,30,40,50,60,70]), 'linear 1→7');
ok(JSON.stringify(earningsPath(10, 70, 40, 60)) === JSON.stringify([10,20,30,40,60,65,70]), 'anchors at 4 and 5');
// r=0: premium 7×(60k−30k)=210k; cost 4×(20k+0.571×30k)=148,520 → npv 61,480
const z = computeRoi({ e1: 60000, e7: 60000, netPrice: 20000, hsEarnings: 30000 }, 0)!;
ok(Math.abs(z.npv - 61480) < 1, `undiscounted npv ${z.npv}`);
ok(z.npv === z.npvUndiscounted, 'r=0 discounted == undiscounted');
// discounted < undiscounted when premium comes later than cost
const d = computeRoi({ e1: 60000, e7: 60000, netPrice: 20000, hsEarnings: 30000 })!;
ok(d.npv < z.npv, `discounting lowers npv (${Math.round(d.npv)})`);
ok(computeRoi({ e1: null, e7: 50000, netPrice: 1, hsEarnings: 1 }) === null, 'missing e1 → null');
// completion 100% → expected == grad
const c = computeRoi({ e1: 60000, e7: 80000, netPrice: 20000, hsEarnings: 30000, completionRate: 1 })!;
ok(Math.abs(c.expectedNpv! - c.npv) < 1e-6, 'completion 1 → expected = graduate');
const c0 = computeRoi({ e1: 60000, e7: 80000, netPrice: 20000, hsEarnings: 30000, completionRate: 0.5 })!;
ok(c0.expectedNpv! < c0.npv, `completion 0.5 lowers expected npv (${Math.round(c0.expectedNpv!)} < ${Math.round(c0.npv)})`);
import { curveAt } from '../src/lib/roi';
const flat = { mids: [27, 32, 37, 42, 47], values: [100, 100, 100, 100, 100] };
const base = { e1: 60000, e7: 60000, netPrice: 20000, hsEarnings: 30000 };
const k = computeRoi({ ...base, career: { major: flat, hs: flat } }, 0)!;
// r=0: extension = 16 years × (60k − 30k) = 480k
ok(Math.abs(k.careerNpv! - (k.npv + 480000)) < 1, `flat career adds 16×30k (${k.careerNpv! - k.npv})`);
const rising = { mids: [27, 32, 37, 42, 47], values: [100, 120, 140, 160, 180] };
ok(Math.abs(curveAt(rising, 29.5)! - 110) < 1e-9, 'curve interpolates mid-band');
const k2 = computeRoi({ ...base, career: { major: rising, hs: flat } })!;
ok(k2.careerNpv! > computeRoi({ ...base, career: { major: flat, hs: flat } })!.careerNpv!, 'rising major curve raises career NPV');
ok(computeRoi(base)!.careerNpv === null, 'no curves → no career view');
