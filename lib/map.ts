import { RCON_Position } from "../main";

function map_coords_to_offsets(
  coords: RCON_Position,
  game_world_edge_length_meters: number,
  map_element_edge_length_px: number,
  marker_size_px: number
): { top: number; left: number } {
  return {
    left: 0,
    top: 0,
  };
}

export { map_coords_to_offsets };
