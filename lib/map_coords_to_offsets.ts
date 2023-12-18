import { RCON_Position } from "../main.jsx";

function map_coords_to_offsets(
  coords: RCON_Position,
  game_world_edge_length_meters: number,
  map_element_edge_length_px: number,
  marker_size_px: number,
  game_world_margin: number,
): { top: number; left: number } {
  const scale = map_element_edge_length_px / (game_world_edge_length_meters + game_world_margin);
  const origin = (game_world_edge_length_meters + game_world_margin) / 2;
  const marker_size_offset = marker_size_px / 2;

  const left = scale * (origin + coords.x) - marker_size_offset;
  const top = scale * (origin - coords.y) - marker_size_offset;

  return {
    left,
    top,
  };
}

export { map_coords_to_offsets };
