import { RCON_Position } from "../main.jsx";

function map_coords_to_offsets(
  coords: RCON_Position,
  game_world_edge_length_meters: number,
  map_element_edge_length_px: number,
  marker_size_px: number
): { top: number; left: number } {
  return {
    left:
      (game_world_edge_length_meters / 2 - coords.x)                 // transform origin
      * (map_element_edge_length_px / game_world_edge_length_meters) // scale
      - marker_size_px / 2,                                          // adjust offset for marker
    top:
      (game_world_edge_length_meters / 2 - coords.y)                 // transform origin
      * (map_element_edge_length_px / game_world_edge_length_meters) // scale
      - marker_size_px / 2,                                          // adjust offset for marker
  };
}

export { map_coords_to_offsets };
