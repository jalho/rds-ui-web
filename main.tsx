import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { map_coords_to_offsets } from "./lib/map_coords_to_offsets.js";

export type RCON_Position = {
  /** Horizontal offset from the map's center. */
  x: number;
  /** Vertical offset from the map's center. */
  y: number;
  /** Altitude. */
  z: number;
};
type RCON_Player = {
  address: string;
  connected_seconds: number;
  display_name: string;
  health: number;
  id: string;
  position: RCON_Position;
};
type RCON_ToolCupboard = {
  id: string;
  position: RCON_Position;
  auth_count: number;
};
type RCON_State = {
  players: Array<RCON_Player>;
  tcs: Array<RCON_ToolCupboard>;
  game_time: number;
  sync_time_ms: number;
};

function RCONView(props: { rcon_state: RCON_State }): React.JSX.Element {
  return (
    <div>
      <ul>
        <li>Synced: {props.rcon_state.sync_time_ms}</li>
        <li>Game time: {props.rcon_state.game_time}</li>
        <li>Players: {props.rcon_state.players.length}</li>
        <li>TCs: {props.rcon_state.tcs.length}</li>
      </ul>
    </div>
  );
}

function Markers(props: {
  data: { [id: string]: MapEntity };
  size_px: number;
  map_dimensions: {
    /**
     * Length of the edges of the square HTML element that renders the game
     * world map.
     */
    map_element_edge_length_px: number;
    /**
     * Length of the edges of the game world in game units (meters).
     * Corresponds to the RustDedicated startup argument `worldsize`.
     *
     * @example 3000
     * @example 4500
     */
    game_world_edge_length_meters: number;
  };
}): React.JSX.Element[] {
  const elements = Object.values(props.data).map(function (entity) {
    const offsets = map_coords_to_offsets(
      entity.position,
      props.map_dimensions.game_world_edge_length_meters,
      props.map_dimensions.map_element_edge_length_px,
      props.size_px
    );

    return (
      <div
        key={entity.id}
        style={{
          position: "absolute",
          top: offsets.top,
          left: offsets.left,
        }}
      >
        <div
          style={{
            backgroundColor: "red",
            width: props.size_px,
            height: props.size_px,
          }}
        />
        <MarkerTooltip entity={entity} />
      </div>
    );
  });

  return elements;
}

function MarkerTooltip(props: { entity: MapEntity }): React.JSX.Element {
  const label = props.entity.id.length === 17 ? "player" : "TC"; // SteamID is len 17 string, entity IDs are shorter
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <span>{label}</span>
      <span>ID: {props.entity.id}</span>
      <span>
        Position: {props.entity.position.x},{props.entity.position.z},{props.entity.position.y}
      </span>
    </div>
  );
}

type ID = string;
type MapEntity = RCON_Player | RCON_ToolCupboard;
type WorldMapProps = {
  edge_length_px: number;
  markers: { [id: string]: MapEntity };
};
function WorldMap(props: WorldMapProps): React.JSX.Element {
  return (
    <>
      <div style={{ position: "relative" }}>
        <img
          src="./.local/map_3000_1337.png"
          style={{
            width: props.edge_length_px,
            height: props.edge_length_px,
            position: "absolute",
          }}
        ></img>
        <Markers
          data={props.markers}
          size_px={10}
          map_dimensions={{
            map_element_edge_length_px: props.edge_length_px,
            game_world_edge_length_meters: 3000, // TODO: get this from backend, or calculate based on the image asset?
          }}
        />
      </div>
    </>
  );
}

function App(): React.JSX.Element {
  const [rcon_state, set_rcon_state] = React.useState<RCON_State>({
    game_time: 0,
    players: [],
    sync_time_ms: 0,
    tcs: [],
  });

  React.useEffect(function connect() {
    const socket = new WebSocket("ws://rds-remote:1234");

    socket.addEventListener("close", function () {
      // TODO!
    });

    socket.addEventListener("error", function () {
      // TODO!
    });

    socket.addEventListener("message", function (message) {
      const remote_state = JSON.parse(message.data);
      set_rcon_state(remote_state);
    });

    socket.addEventListener("open", function () {
      // TODO!
    });
  }, []);

  return (
    <>
      <RCONView rcon_state={rcon_state} />
      <WorldMap edge_length_px={750} markers={make_markers(rcon_state)} />
    </>
  );
}

function make_markers(rcon_state: RCON_State): { [id: string]: MapEntity } {
  const map: { [id: string]: MapEntity } = {};

  // TODO: get as a hash map from backend instead!
  for (const player of rcon_state.players) map[player.id] = player;

  for (const tc of rcon_state.tcs) map[tc.id] = tc;

  return map;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
