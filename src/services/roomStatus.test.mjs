import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRoom } from "./roomStatus.js";

const c = (roomId, roomName, serverRoom) =>
  classifyRoom({ roomId, roomName, serverRoom });

test("empty id stays idle", () => {
  assert.equal(c("", "Sprint", { exists: false, name: "" }), "idle");
});

test("checking (serverRoom null) stays idle", () => {
  assert.equal(c("abc", "Sprint", null), "idle");
});

test("unknown id with name offers create", () => {
  assert.equal(c("abc", "Sprint", { exists: false, name: "" }), "create");
});

test("unknown id without name stays idle", () => {
  assert.equal(c("abc", "  ", { exists: false, name: "" }), "idle");
});

test("existing id with matching name offers join", () => {
  assert.equal(c("abc", " Sprint ", { exists: true, name: "Sprint" }), "join");
});

test("existing id with wrong name flags mismatch", () => {
  assert.equal(c("abc", "Other", { exists: true, name: "Sprint" }), "nameMismatch");
});

test("existing room with empty stored name allows join", () => {
  assert.equal(c("abc", "Sprint", { exists: true, name: "" }), "join");
});
