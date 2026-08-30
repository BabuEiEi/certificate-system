import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkItems,
  isEventDeletionLocked,
  matchesDeletionConfirmation,
  normalizeDeletionConfirmation,
} from "../src/lib/deletion.js";

test("deletion confirmation normalizes unicode and repeated whitespace", () => {
  assert.equal(normalizeDeletionConfirmation("  กิจกรรม   ทดสอบ  "), "กิจกรรม ทดสอบ");
  assert.equal(matchesDeletionConfirmation("ＡＢＣ", "ABC"), true);
  assert.equal(matchesDeletionConfirmation("กิจกรรม ก", "กิจกรรม ข"), false);
});

test("event deletion lock covers active and failed deletion attempts", () => {
  assert.equal(isEventDeletionLocked({ deletion_status: "IN_PROGRESS" }), true);
  assert.equal(isEventDeletionLocked({ deletion_status: "FAILED" }), true);
  assert.equal(isEventDeletionLocked({}), false);
});

test("large deletion workloads are split below Firestore batch limits", () => {
  const items = Array.from({ length: 905 }, (_, index) => index);
  const chunks = chunkItems(items);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [400, 400, 105]);
  assert.deepEqual(chunks.flat(), items);
});
