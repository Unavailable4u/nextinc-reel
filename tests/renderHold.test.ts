// Patch 20b: the holds on the render live outside React, so a render React throws away cannot leave a hold nobody lets go of.
import { createHolds } from "../src/lib/renderHold";
import { eq, test, truthy } from "./harness";

function fake() {
  const log: string[] = [];
  let n = 0;
  const holds = createHolds(
    (label, options) => {
      n++;
      log.push(`delay ${n} "${label}"${options?.timeoutInMilliseconds ? ` ${options.timeoutInMilliseconds}` : ""}`);
      return n;
    },
    (h) => log.push(`continue ${h}`),
  );
  return { holds, log };
}

test("holds: asking twice for the same key takes one delayRender, and one release lets it go", () => {
  const { holds, log } = fake();
  holds.hold("cover:mini-me", "Painting the cover of mini-me");
  holds.hold("cover:mini-me", "Painting the cover of mini-me");
  eq(holds.open(), 1);
  eq(log.length, 1, "one delayRender");
  holds.release("cover:mini-me");
  eq(holds.open(), 0);
  eq(log.join("|"), 'delay 1 "Painting the cover of mini-me"|continue 1');
});

test("holds: a render React throws away and retries (the hold is asked for again) leaves nothing held after the one release", () => {
  const { holds } = fake();
  // the first attempt of FilmSet asks for the hold and is thrown away before it commits, the retry asks again, the effect lets go once
  for (const _attempt of [1, 2, 3]) holds.hold("act-pages", "Painting the pages of act 4", 240000);
  holds.release("act-pages");
  eq(holds.open(), 0, "this was the leak: the timeout at 238000 ms after a painting that took 2 seconds");
});

test("holds: releasing a key that is not held does nothing, and a key can be held again after a release", () => {
  const { holds, log } = fake();
  holds.release("act-pages");
  eq(log.length, 0);
  holds.hold("act-pages", "a");
  holds.release("act-pages");
  holds.release("act-pages");
  holds.hold("act-pages", "b");
  eq(log.join("|"), 'delay 1 "a"|continue 1|delay 2 "b"');
  eq(holds.open(), 1);
});

test("holds: keys are independent, and a timeout goes to its own delayRender only", () => {
  const { holds, log } = fake();
  holds.hold("cover:mini-me", "c1");
  holds.hold("cover:minilocker", "c2");
  holds.hold("act-pages", "p", 240000);
  eq(holds.open(), 3);
  truthy(log[2].endsWith("240000") && !log[0].includes("240000") && !log[1].includes("240000"), "the timeout is passed only where it was asked");
  holds.release("cover:minilocker");
  eq(holds.open(), 2);
});
