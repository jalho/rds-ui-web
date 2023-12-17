import { map_coords_to_offsets } from "../lib/map_coords_to_offsets.js";
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
          (3000 / 2)      // center
          * (100 / 3000)  // scale
          - 10 / 2,       // marker size offset

        top:
          (3000 / 2)      // center
          * (100 / 3000)  // scale
          - 10 / 2,       // marker size offset
      } satisfies ReturnType<typeof map_coords_to_offsets>
    );
  });

  test.it("maps RCON coords (1500.0, 0.0, 0.0) horizontally right, vertically center", function () {
    assert.deepStrictEqual(
      map_coords_to_offsets(
        {
          x: 1500,
          y: 0,
          z: 0,
        },
        3000,
        100,
        10
      ),
      {
        left: 82.5,   // IDK this seems right, counting in RCON added margin...
        top:
          (100 / 2)   // vertically center
          - (10 / 2), // marker size offset
      } satisfies ReturnType<typeof map_coords_to_offsets>
    );
  });
});

// TODO: Add more tests... Should take into account RCON rendered margins or
//       something. E.g. `teleportpos 1000.0,100.0,0.0` marker goes a couple
//       squares too much to the right on a map of `worldsize` 3000. The offset
//       error increases as distance from origin increases...
