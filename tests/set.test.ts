// PATCH 12: the set, by the numbers. The pile, the places beside it, the riser and its four books, the continuity ledger's table, and the
// dust. The looks are the stills of `DevPile` and `DevRiser`; these are the rules a number can check: nothing overlaps, nothing floats,
// every book exists once, the swap happens on its frames, and the dust is a pure function of the frame.
import { test, eq, near, truthy } from "./harness";
import { BOOKS, BOOK_IDS, PILE, RISER, SPINE_TO_CAMERA_YAW_DEG, closedThickness, pilePoses, type BookId } from "../src/config/books";
import { DESK_MARGIN_CM, EXCLUSIONS, ZONES, footprintInZone, rectGapCm } from "../src/config/placement";
import { TOTAL } from "../src/config/timeline";
import { BESIDE, LEDGER, booksAt, besidePose, getBookLocation, getBookPose, getBookState, pilePose, type BookLocation } from "../src/config/ledger";
import { getRiserSlots, riserBoxes, riserFootprint, riserPose, riserSlots, standingCorners, standingPitchDeg, type DeskBox } from "../src/config/riser";
import { footprintOf } from "../src/book/rig/pose";
import { PLATE_MATCH } from "../src/plate/PlateFollow";
import { projectDesk } from "../src/plate/plateCamera";
import { DUST } from "../src/config/dust";
import { boxFade, coneMask, disturbance, dustAt, dustSources, falloffAt, lampDesk, puffEnvelope, puffReach, type DustSource } from "../src/scene/dustField";
import { GRAIN_SIZE, woodGrainPixels } from "../src/scene/woodGrain";

type Rect = { x0: number; x1: number; zd0: number; zd1: number };
const rectOf = (id: BookId, pose: Parameters<typeof footprintOf>[1]): Rect => {
  const f = footprintOf(id, pose);
  const xs = f.map((c) => c.X);
  const zs = f.map((c) => c.Zd);
  return { x0: Math.min(...xs), x1: Math.max(...xs), zd0: Math.min(...zs), zd1: Math.max(...zs) };
};
const DESK = { x0: PLATE_MATCH.deskXMinCm + DESK_MARGIN_CM, x1: PLATE_MATCH.deskXMaxCm - DESK_MARGIN_CM, zd0: DESK_MARGIN_CM, zd1: PLATE_MATCH.deskDepthCm - DESK_MARGIN_CM };
const inRect = (r: Rect, o: Rect): boolean => r.x0 >= o.x0 && r.x1 <= o.x1 && r.zd0 >= o.zd0 && r.zd1 <= o.zd1;
const chair = EXCLUSIONS.find((e) => e.id === "chair")!;
/** True when a desk rectangle at height Y (cm) shows in the picture within the chair's box widened by its clearance */
const behindChair = (r: Rect, Y: number): boolean => {
  const xs = [r.x0, r.x1].flatMap((X) => [r.zd0, r.zd1].map((Zd) => projectDesk(PLATE_MATCH, X, Y, Zd).x));
  const c = chair.clearancePx ?? 0;
  return Math.max(...xs) > chair.photoBox.x0 - c && Math.min(...xs) < chair.photoBox.x1 + c;
};

// ---- the riser ------------------------------------------------------------------------------------------------------------------

test("riser: 36 x 24 cm, centred on zone R's anchor, inside the zone, clear of the speaker and the headset stand", () => {
  const fp = riserFootprint();
  near(fp.x1 - fp.x0, RISER.widthCm, 1e-9, "width");
  near(fp.zd1 - fp.zd0, RISER.depthCm, 1e-9, "depth");
  eq(RISER.widthCm, 36);
  eq(RISER.depthCm, 24);
  near((fp.x0 + fp.x1) / 2, ZONES.R.anchor.X, 1e-9);
  near((fp.zd0 + fp.zd1) / 2, ZONES.R.anchor.Zd, 1e-9);
  truthy(footprintInZone(ZONES.R, ZONES.R.anchor.X, ZONES.R.anchor.Zd, RISER.widthCm, RISER.depthCm), "the footprint is inside the zone");
  truthy(fp.zd0 >= DESK_MARGIN_CM, `the riser's front edge is ${fp.zd0} cm from the desk's front edge (margin ${DESK_MARGIN_CM})`);
  for (const e of EXCLUSIONS) if (e.desk) truthy(rectGapCm(fp, e.desk) > 0, `clear of ${e.id}`);
  truthy(!behindChair({ ...fp }, RISER.lowerTopCm + RISER.riseCm + 23), "the chair does not hide the riser in the picture");
});

test("riser: two tiers, the upper 6 cm higher and set 8 cm back, each with a brass lip at its front", () => {
  const b = riserBoxes();
  const fp = riserFootprint();
  eq(RISER.riseCm, 6);
  eq(RISER.setBackCm, 8);
  eq(RISER.leanDeg, 4);
  near(b.upper.y1 - b.lower.y1, 6, 1e-9, "the rise");
  near(b.lower.zd0, fp.zd0, 1e-9, "the lower tier is at the front");
  near(b.lower.zd1 - b.lower.zd0, 8, 1e-9, "the lower tier is the step's depth");
  near(b.upper.zd0, b.lower.zd1, 1e-9, "the tiers meet");
  near(b.upper.zd1, fp.zd1, 1e-9, "the upper tier reaches the back");
  for (const lip of [b.lipLower, b.lipUpper]) truthy(lip.x0 > fp.x0 && lip.x1 < fp.x1, "a lip is inset from the sides");
  near(b.lipLower.y0, b.lower.y1, 1e-9, "the lower lip stands on the lower tier");
  near(b.lipUpper.y0, b.upper.y1, 1e-9, "the upper lip stands on the upper tier");
  near(b.lipLower.zd0, b.lower.zd0, 1e-9, "at its front");
  near(b.lipUpper.zd0, b.upper.zd0, 1e-9, "at its front");
});

test("riser: four books, Vol. I to Vol. IV, the first two on the lower tier and the last two on the upper", () => {
  const s = riserSlots();
  eq(s.length, 4);
  eq(s.map((x) => x.volume).join(","), "1,2,3,4");
  eq(s.map((x) => x.tier).join(","), "lower,lower,upper,upper");
  eq(new Set(s.map((x) => x.id)).size, 4, "every book once");
  for (const id of BOOK_IDS) truthy(s.some((x) => x.id === id), `${id} is on the riser`);
  for (const x of s) near(x.pose.pitchDeg ?? 0, 90 - RISER.leanDeg, 1e-9, `${x.id}: leans 4 degrees back (pitch 86)`);
  near(standingPitchDeg(), 86, 1e-12);
});

test("riser: every standing book rests on its tier (its lowest edge is on the top), never through it", () => {
  for (const s of riserSlots()) {
    const ys = standingCorners(s.id, s.pose).map((c) => c.Y);
    near(Math.min(...ys), s.tierTopY, 1e-6, `${s.id}: the lowest edge is on the tier`);
  }
});

test("riser: the cover's edge stands behind the lip and the clearance under it is hidden by the lip", () => {
  const b = riserBoxes();
  for (const s of riserSlots()) {
    const lip = s.tier === "lower" ? b.lipLower : b.lipUpper;
    const c = standingCorners(s.id, s.pose);
    // the corners of the cover-and-tail edge are the ones nearest the camera
    const nearest = Math.min(...c.map((q) => q.Zd));
    truthy(nearest >= lip.zd1 + 0.05, `${s.id}: the book is behind its lip (${nearest} against ${lip.zd1})`);
    const T = closedThickness(BOOKS[s.id]);
    const clearance = T * Math.tan((RISER.leanDeg * Math.PI) / 180);
    truthy(clearance < lip.y1 - lip.y0, `${s.id}: the ${clearance.toFixed(2)} cm under the cover is shorter than the lip`);
    near(s.foot.y, s.tierTopY, 1e-12, "the foot patch is on the tier");
    near(s.foot.w, BOOKS[s.id].trimW, 1e-12);
    near(s.foot.d, T * Math.cos((RISER.leanDeg * Math.PI) / 180), 1e-12);
  }
});

test("riser: the books fit the tiers: inside the footprint, a gap between neighbours, nothing inside a tier or a lip", () => {
  const fp = riserFootprint();
  const boxes = riserBoxes();
  const all: DeskBox[] = [boxes.lower, boxes.upper, boxes.lipLower, boxes.lipUpper];
  const spans = riserSlots().map((s) => {
    const c = standingCorners(s.id, s.pose);
    const xs = c.map((q) => q.X);
    for (const q of c) {
      truthy(q.X >= fp.x0 && q.X <= fp.x1 && q.Zd >= fp.zd0 && q.Zd <= fp.zd1, `${s.id}: inside the footprint`);
      for (const bx of all) {
        const inside = q.X > bx.x0 + 1e-6 && q.X < bx.x1 - 1e-6 && q.Zd > bx.zd0 + 1e-6 && q.Zd < bx.zd1 - 1e-6 && q.Y > bx.y0 + 1e-6 && q.Y < bx.y1 - 1e-6;
        truthy(!inside, `${s.id}: a corner is inside a box of the riser`);
      }
    }
    return { tier: s.tier, id: s.id, x0: Math.min(...xs), x1: Math.max(...xs) };
  });
  for (const tier of ["lower", "upper"]) {
    const row = spans.filter((s) => s.tier === tier).sort((a, b) => a.x0 - b.x0);
    eq(row.length, 2, `${tier}: two books`);
    truthy(row[1].x0 - row[0].x1 >= 1, `${tier}: a gap of ${(row[1].x0 - row[0].x1).toFixed(2)} cm between the books`);
  }
  // the lower books lean back but do not reach the step: the upper tier stands clear of them
  for (const s of riserSlots().filter((x) => x.tier === "lower")) truthy(Math.max(...standingCorners(s.id, s.pose).map((q) => q.Zd)) < boxes.lower.zd1 - 1, `${s.id}: a hand's width of the lower tier is free behind it`);
});

test("riser: the slots are a pure function of the data, and they move with the anchor", () => {
  const a = getRiserSlots();
  const b = getRiserSlots();
  eq(JSON.stringify(a), JSON.stringify(b));
  const shifted = getRiserSlots({ X: ZONES.R.anchor.X + 5, Zd: ZONES.R.anchor.Zd });
  for (let i = 0; i < a.length; i++) {
    near(shifted[i].pose.position[0] - a[i].pose.position[0], 5, 1e-9, "X");
    near(shifted[i].pose.position[1], a[i].pose.position[1], 1e-9, "Y");
    near(shifted[i].pose.position[2], a[i].pose.position[2], 1e-9, "Z");
  }
  eq(JSON.stringify(riserPose("mini-me")), JSON.stringify(a[0].pose));
});

test("riser: the walnut grain is the same twice, and its mean is the 0.88 the colour was brightened for", () => {
  const { w, h } = GRAIN_SIZE;
  const a = woodGrainPixels(w, h);
  const b = woodGrainPixels(w, h);
  eq(a.length, w * h * 4);
  eq(Array.from(a).join(","), Array.from(b).join(","));
  let sum = 0;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < a.length; i += 4) {
    sum += a[i];
    lo = Math.min(lo, a[i]);
    hi = Math.max(hi, a[i]);
    eq(a[i], a[i + 1]);
  }
  near(sum / (a.length / 4) / 255, 0.88, 0.02, "mean");
  truthy(hi - lo >= 8 && hi <= 255, "there is grain, and it does not clip");
});

// ---- the pile and the places beside it ------------------------------------------------------------------------------------------

test("pile: MiniMe on top, MiniLocker, SPHEREx at the bottom, askew, the spines to the camera, inside zone L", () => {
  eq(PILE.map((s) => s.id).join(","), "spherex-blink,minilocker,mini-me", "bottom to top");
  eq(PILE.map((s) => s.yawDeg).join(","), "3,-2,1", "yaw offsets +3, -2, +1");
  const poses = pilePoses(ZONES.L.anchor);
  let y = 0;
  for (const p of poses) {
    near(p.pose.position[1], y, 1e-9, `${p.id}: stands on the book below`);
    y += closedThickness(BOOKS[p.id]);
    const yaw = (p.pose.yawDeg ?? 0) - SPINE_TO_CAMERA_YAW_DEG;
    truthy(Math.abs(yaw) > 0.5 && Math.abs(yaw) <= 3.01, `${p.id}: askew by ${yaw} degrees`);
    truthy(Math.hypot(p.pose.position[0] - ZONES.L.anchor.X, -p.pose.position[2] - ZONES.L.anchor.Zd) <= 1, `${p.id}: lateral offset under 1 cm`);
    truthy(footprintInZone(ZONES.L, ZONES.L.anchor.X, ZONES.L.anchor.Zd, BOOKS[p.id].trimH, BOOKS[p.id].trimW), `${p.id}: inside zone L`);
    eq(JSON.stringify(pilePose(p.id)), JSON.stringify(p.pose), "the ledger's pile pose is Patch 06's");
  }
});

test("beside: the two spots lie on the desk, clear of the pile, each other, the desk's ends and every exclusion", () => {
  const ids = Object.keys(BESIDE) as BookId[];
  eq(ids.sort().join(","), "mini-me,minilocker");
  const pile = PILE.map((s) => rectOf(s.id, pilePose(s.id)));
  const rects = ids.map((id) => ({ id, r: rectOf(id, besidePose(id)) }));
  for (const { id, r } of rects) {
    near(besidePose(id).position[1], 0, 1e-12, `${id}: on the desk`);
    truthy(inRect(r, DESK), `${id}: inside the desk with its margin (${JSON.stringify(r)})`);
    for (const p of pile) truthy(rectGapCm(r, p) >= 1, `${id}: a hand's breadth from the pile (${rectGapCm(r, p).toFixed(2)} cm)`);
    for (const e of EXCLUSIONS) if (e.desk) truthy(rectGapCm(r, e.desk) > 5, `${id}: clear of ${e.id}`);
    truthy(!behindChair(r, 3), `${id}: the chair does not hide it`);
  }
  truthy(rectGapCm(rects[0].r, rects[1].r) >= 1, `the two books beside the pile are ${rectGapCm(rects[0].r, rects[1].r).toFixed(2)} cm apart`);
});

// ---- the ledger -----------------------------------------------------------------------------------------------------------------

/** The table of guide 01 ("Continuity ledger"), as the storyboard states it, at the frames the patch asks for. */
const TABLE: { frame: number; where: Record<BookId, BookLocation> }[] = [
  { frame: 0, where: { "mini-me": "pile", minilocker: "pile", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 960, where: { "mini-me": "hand", minilocker: "pile", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 2880, where: { "mini-me": "beside", minilocker: "pile", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 3000, where: { "mini-me": "beside", minilocker: "hand", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 3840, where: { "mini-me": "beside", minilocker: "beside", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 4139, where: { "mini-me": "beside", minilocker: "beside", "spherex-blink": "pile", "next-inc-immersive": "absent" } },
  { frame: 4200, where: { "mini-me": "riser", minilocker: "riser", "spherex-blink": "riser", "next-inc-immersive": "riser" } },
  { frame: 5399, where: { "mini-me": "riser", minilocker: "riser", "spherex-blink": "riser", "next-inc-immersive": "riser" } },
];

test("ledger: getBookLocation gives the storyboard's table at frames 0, 960, 2880, 3000, 3840, 4139, 4200 and 5399", () => {
  for (const t of TABLE) for (const id of BOOK_IDS) eq(getBookLocation(id, t.frame), t.where[id], `${id} at ${t.frame}`);
});

test("ledger: the swap is frames 4140 to 4199 and nothing else: the three books are under it, Immersive is on the riser", () => {
  for (const f of [4139, 4140, 4170, 4199, 4200]) {
    const w = (id: BookId) => getBookLocation(id, f);
    if (f < 4140) eq(w("next-inc-immersive"), "absent", `Immersive is not in the scene at ${f}`);
    else eq(w("next-inc-immersive"), "riser", `Immersive is on the riser at ${f}`);
    for (const id of ["mini-me", "minilocker", "spherex-blink"] as const) {
      if (f >= 4140 && f <= 4199) eq(w(id), "swap", `${id} is under the swap at ${f}`);
      else eq(w(id), f < 4140 ? w(id) : "riser", `${id} at ${f}`);
    }
  }
  const swap = LEDGER.find((r) => r.where["mini-me"] === "swap")!;
  eq(swap.from, 4140);
  eq(swap.to, 4199);
});

test("ledger: every book is in exactly one place at every frame (booksAt is a partition), and the counts follow the table", () => {
  for (let f = 0; f < TOTAL; f += 11) {
    const at = booksAt(f);
    const flat = (Object.values(at) as BookId[][]).flat();
    eq(flat.length, BOOK_IDS.length, `at ${f}`);
    eq(new Set(flat).size, BOOK_IDS.length, `no book twice at ${f}`);
    for (const id of BOOK_IDS) truthy(at[getBookLocation(id, f)].includes(id), `${id} listed where it is at ${f}`);
  }
  eq(booksAt(0).pile.length, 3);
  eq(booksAt(3000).pile.length, 1);
  eq(booksAt(3000).beside.length, 1);
  eq(booksAt(3000).hand.length, 1);
  eq(booksAt(3840).beside.length, 2);
  eq(booksAt(4170).swap.length, 3);
  eq(booksAt(5000).riser.length, 4);
});

test("ledger: nothing comes back to the pile or leaves the riser, and the riser's books only arrive at the swap", () => {
  const rank: Record<BookLocation, number> = { absent: 0, pile: 1, hand: 2, beside: 3, swap: 4, riser: 5 };
  for (const id of BOOK_IDS) {
    let last = -1;
    let sawRiser = false;
    for (let f = 0; f < TOTAL; f++) {
      const w = getBookLocation(id, f);
      if (w === "pile" && last >= rank.hand) {
        // the pile is only left, never rejoined (MiniLocker and SPHEREx wait in it until they are lifted)
        throw new Error(`${id} returns to the pile at ${f}`);
      }
      if (sawRiser) eq(w, "riser", `${id} stays on the riser at ${f}`);
      if (w === "riser") sawRiser = true;
      last = rank[w];
    }
    truthy(sawRiser, `${id} ends on the riser`);
  }
});

test("ledger: getBookPose gives the pile's, the hand's, the set-down's and the riser's poses, and nothing under the swap or before a book is there", () => {
  for (const id of BOOK_IDS) {
    for (const f of [0, 500, 1007, 2000, 2900, 3100, 3900, 4139, 4140, 4170, 4199, 4200, 4580, 5399]) {
      const w = getBookLocation(id, f);
      const pose = getBookPose(id, f);
      const state = getBookState(id, f);
      if (w === "swap" || w === "absent") {
        eq(pose, null, `${id} at ${f}: not drawn`);
        eq(state, null, `${id} at ${f}: no state`);
      } else {
        truthy(pose !== null && state !== null, `${id} at ${f}: drawn`);
        eq(state!.location, w);
        for (const v of pose!.position) truthy(Number.isFinite(v), `${id} at ${f}: finite`);
      }
      if (w === "riser") eq(JSON.stringify(pose), JSON.stringify(riserPose(id)), `${id} at ${f}: the riser's slot`);
    }
  }
  // Immersive appears on the riser at 4140, before the others
  eq(JSON.stringify(getBookPose("next-inc-immersive", 4140)), JSON.stringify(riserPose("next-inc-immersive")));
  eq(getBookPose("minilocker", 4140), null);
});

test("ledger: the books on the riser stand still, closed, with the cover shut", () => {
  for (const id of BOOK_IDS) {
    const a = getBookState(id, 4300)!;
    const b = getBookState(id, 5000)!;
    eq(JSON.stringify(a.pose), JSON.stringify(b.pose), `${id}: the pose does not change`);
    near(a.coverAngle, 0, 1e-9, `${id}: closed`);
    near(a.turned, 0, 1e-9, `${id}: no sheet turned`);
    eq(a.airSheets.length, 0);
  }
});

test("ledger: resting books never overlap in plan: the pile, the two beside it", () => {
  for (const f of [0, 959, 2880 + 200, 3000 + 400, 3840 + 200, 4139]) {
    const rest = BOOK_IDS.filter((id) => {
      const s = getBookState(id, f);
      return s && (s.location === "beside" || (s.location === "pile" && s.pose.position[1] < 0.01)) && s.pose.position[1] < 0.05;
    });
    for (let i = 0; i < rest.length; i++)
      for (let j = i + 1; j < rest.length; j++) {
        const a = rectOf(rest[i], getBookPose(rest[i], f)!);
        const b = rectOf(rest[j], getBookPose(rest[j], f)!);
        truthy(rectGapCm(a, b) > 0.5, `${rest[i]} and ${rest[j]} at ${f}: ${rectGapCm(a, b).toFixed(2)} cm apart`);
      }
  }
});

// ---- the dust -------------------------------------------------------------------------------------------------------------------

test("dust: a pure function of the frame: the same twice, in any order, from any frame", () => {
  const a = JSON.stringify(dustAt(777));
  dustAt(4000);
  dustAt(12);
  eq(JSON.stringify(dustAt(777)), a, "frame 777 after other frames");
  eq(JSON.stringify(dustAt(777, dustSources())), a, "with the sources given");
  eq(JSON.stringify(dustSources()), JSON.stringify(dustSources()));
});

test("dust: the lamp lights a steady number of motes at every frame, in range, inside the box and the cone", () => {
  const l = lampDesk();
  for (const f of [0, 239, 960, 1500, 2858, 3004, 3904, 4500, 5399]) {
    const m = dustAt(f);
    truthy(m.length >= 100 && m.length <= 320, `frame ${f}: ${m.length} motes lit`);
    for (const x of m) {
      truthy(x.brightness > 0 && x.brightness <= 1, `brightness ${x.brightness}`);
      truthy(x.sizeCm >= DUST.sizeCm[0] - 1e-9 && x.sizeCm <= DUST.sizeCm[1] + 1e-9, "size");
      truthy(Number.isFinite(x.X + x.Y + x.Zd), "finite");
      truthy(x.Y > 0, "above the desk");
      truthy(Math.hypot(x.X - l.X, x.Y - l.Y, x.Zd - l.Zd) >= DUST.cone.nearCm * 0.5, "not on the bulb");
    }
  }
});

test("dust: the cone, the box and the falloff", () => {
  const l = lampDesk();
  const aim = DUST.cone.aim;
  truthy(coneMask(aim) > 0.99, "the middle of the pile is inside the cone");
  eq(coneMask({ X: l.X, Y: l.Y, Zd: l.Zd }), 0, "nothing on the bulb");
  eq(coneMask({ X: l.X + 1, Y: l.Y, Zd: l.Zd }), 0, "nothing next to the bulb");
  eq(coneMask({ X: 150, Y: 20, Zd: 10 }), 0, "nothing far off the axis");
  eq(coneMask({ X: -35, Y: 40, Zd: 60 }), 0, "nothing behind the lamp");
  const B = DUST.box;
  eq(boxFade({ X: B.x0, Y: 10, Zd: 10 }), 0, "dark at a face");
  eq(boxFade({ X: 0, Y: 20, Zd: 20 }), 1, "bright inside");
  near(falloffAt(DUST.falloff.refCm), 1, 1e-12, "1 at the reference distance");
  eq(falloffAt(1), DUST.falloff.max, "capped near the bulb");
  eq(falloffAt(1000), DUST.falloff.min, "floored far away");
  truthy(falloffAt(40) > falloffAt(80), "falls with distance");
});

test("dust: what stirs it is the ledger's lifts, closes and set-downs, in order, at the frames the rigs give", () => {
  const s = dustSources();
  eq(s.length, 6, "two scripted books, three events each");
  for (let i = 1; i < s.length; i++) truthy(s[i].frame >= s[i - 1].frame, "sorted by frame");
  eq(s.map((x) => x.what).join("|"), "mini-me lifts|mini-me closes|mini-me sets down|minilocker lifts|minilocker closes|minilocker sets down");
  eq(s[0].strength, DUST.events.lift);
  eq(s[1].strength, DUST.events.close);
  eq(s[2].strength, DUST.events.setDown);
  truthy(s[0].frame > 960 && s[0].frame < 1100, `Mini Me's rise begins ${s[0].frame}, after the press from 960`);
  truthy(s[2].frame > 2880 && s[2].frame < 3000, `Mini Me touches down ${s[2].frame}, inside its carry`);
  truthy(s[3].frame > 3000 && s[3].frame < 3100, "MiniLocker's rise");
  // a set-down puff is over the book that touched
  near(s[2].X, besidePose("mini-me").position[0], 1e-9);
});

test("dust: a puff rises over 0.6 s, peaks, dies away, reaches 15 cm and pushes outward and up", () => {
  const D = DUST.disturb;
  eq(puffEnvelope(0), 0);
  eq(puffEnvelope(-1), 0);
  near(puffEnvelope(D.riseSec), 1, 1e-12, "the peak");
  truthy(puffEnvelope(D.riseSec / 2) > 0 && puffEnvelope(D.riseSec / 2) < 1, "rising");
  truthy(puffEnvelope(D.riseSec + D.fallSec) < 0.4 && puffEnvelope(D.riseSec + 5 * D.fallSec) < 0.01, "dying away");
  near(puffReach(0), 1, 1e-12);
  truthy(puffReach(D.radiusCm) < 0.25 && puffReach(D.radiusCm) > 0.1, "about a fifth at the radius");
  const src: DustSource = { frame: 100, X: 0, Y: 5, Zd: 16, strength: 1, what: "test" };
  const at = (f: number, p = { X: 4, Y: 8, Zd: 16 }) => disturbance(f, p, 0.5, 0.5, [src]);
  const none = at(100);
  eq(none.dx + none.dy + none.dz, 0, "nothing before or at the frame");
  const peak = at(100 + Math.round(D.riseSec * 60));
  truthy(peak.dx > 0, "outward (the mote is to the right of the source)");
  truthy(peak.dy > 0, "up");
  truthy(Math.hypot(peak.dx, peak.dy, peak.dz) <= D.peakCm * 1.5 + 1e-9, "no more than the peak push");
  const far = at(100 + 36, { X: 60, Y: 8, Zd: 16 });
  eq(far.dx + far.dy + far.dz, 0, "nothing beyond 2.2 radii");
  const late = at(100 + 60 * 20);
  eq(late.dx + late.dy + late.dz, 0, "nothing after the horizon");
});

test("dust: a lift stirs the motes near the pile, and the field is calm without it", () => {
  const s = dustSources();
  const lift = s[0];
  const near12 = (m: { X: number; Y: number; Zd: number }) => Math.hypot(m.X - lift.X, m.Y - lift.Y, m.Zd - lift.Zd) < 12;
  // the same frame with and without the sources: only motes near the lift move
  const f = lift.frame + Math.round(DUST.disturb.riseSec * 60);
  const calm = dustAt(f, []);
  const stirred = dustAt(f, s);
  truthy(calm.length > 0 && stirred.length > 0);
  const key = (m: { X: number; Y: number; Zd: number }) => `${m.X.toFixed(6)},${m.Y.toFixed(6)},${m.Zd.toFixed(6)}`;
  const calmKeys = new Set(calm.map(key));
  const moved = stirred.filter((m) => !calmKeys.has(key(m)));
  truthy(moved.length >= 3, `${moved.length} motes were pushed`);
  for (const m of moved) truthy(Math.hypot(m.X - lift.X, m.Y - lift.Y, m.Zd - lift.Zd) < 40, "only near the lift (they were pushed from within 33 cm)");
  truthy(stirred.some(near12) || calm.some(near12), "motes are around the pile");
});

test("dust: the light never pops: the total brightness changes little from one frame to the next across the whole film", () => {
  const total = (f: number): number => dustAt(f).reduce((a, m) => a + m.brightness, 0);
  let worst = 0;
  for (let f = 0; f < TOTAL - 1; f += 37) {
    const a = total(f);
    const b = total(f + 1);
    worst = Math.max(worst, Math.abs(b - a) / a);
  }
  truthy(worst < 0.05, `the total brightness moves at most ${(worst * 100).toFixed(2)} percent in a frame`);
});
