import { test } from "node:test";
import assert from "node:assert/strict";
import { newRoomId } from "./roomId.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("id is v4-shaped", () => {
  assert.match(newRoomId(), UUID_V4);
});

test("ids are unique", () => {
  const ids = new Set(Array.from({ length: 500 }, newRoomId));
  assert.equal(ids.size, 500);
});

test("fallback path works without crypto.randomUUID", () => {
  const real = crypto.randomUUID;
  crypto.randomUUID = undefined; // simulate the insecure-context case
  try {
    assert.match(newRoomId(), UUID_V4);
  } finally {
    crypto.randomUUID = real;
  }
});
