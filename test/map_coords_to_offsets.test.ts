import { map_coords_to_offsets } from "../lib/map.js";
import test from "node:test";
import * as assert from "node:assert";

test.describe("map_coords_to_offsets", function () {
  test.it("maps RCON coords (0.0, 0.0, 0.0) to the center", function () {
    assert.deepStrictEqual(
      map_coords_to_offsets(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        3000,
        100,
        10
      ),
      {
        left:
          (3000 / 2 - 0)  // transform origin
          * (100 / 3000)  // scale
          - 10 / 2,       // adjust offset for marker
        
        top:
          (3000 / 2 - 0)  // transform origin
          * (100 / 3000)  // scale
          - 10 / 2,       // adjust offset for marker
      } satisfies ReturnType<typeof map_coords_to_offsets>
    );
  });
});
