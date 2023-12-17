import { map_coords_to_offsets } from "../lib/map.js";
import test from "node:test";
import * as assert from "node:assert";

test.describe("map_coords_to_offsets", function () {
  test.it("works", function () {
    assert.equal(typeof map_coords_to_offsets, "function");
  });
});
