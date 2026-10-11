import { test } from "node:test";
import assert from "node:assert/strict";
import { wipeEmptyRoom } from "./roomWipe.js";

test("room that still has users is kept", () => {
  const rooms = { a: { users: [{ socketId: "s1" }], name: "A", code: "x" } };
  wipeEmptyRoom(rooms, "a");
  assert.ok(rooms.a, "occupied room must not be wiped");
});

test("room with no users is wiped: id, name, and code gone", () => {
  const rooms = { a: { users: [], name: "Sprint", code: "secret" } };
  wipeEmptyRoom(rooms, "a");
  assert.equal("a" in rooms, false, "empty room must be deleted from the store");
});

test("missing room is a no-op", () => {
  const rooms = {};
  assert.doesNotThrow(() => wipeEmptyRoom(rooms, "ghost"));
  assert.equal("ghost" in rooms, false);
});
