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
  data: { [id: ID]: MapEntity };
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
    /**
     * Margin on top of `game_world_edge_length_meters` rendered in the game
     * world image.
     */
    game_world_margin: number;
  };
}): React.JSX.Element[] {
  const elements = Object.values(props.data).map(function (entity) {
    const [tooltip_open, set_tooltip_open] = React.useState<boolean>(false);

    const offsets = map_coords_to_offsets(
      entity.position,
      props.map_dimensions.game_world_edge_length_meters,
      props.map_dimensions.map_element_edge_length_px,
      props.size_px,
      props.map_dimensions.game_world_margin
    );

    const tooltip =
      entity.discriminator === "player" ? <PlayerTooltip entity={entity} /> : <TCTooltip entity={entity} />;

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
            borderRadius: "50%",
            opacity: "70%",
          }}
          onMouseEnter={function (event) {
            if (!tooltip_open) set_tooltip_open(true);
          }}
          onMouseLeave={function (event) {
            if (tooltip_open) set_tooltip_open(false);
          }}
        />
        {tooltip_open && tooltip}
      </div>
    );
  });

  return elements;
}

function TCTooltip(props: { entity: RCON_ToolCupboard }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <span>TC</span>
      <span>ID: {props.entity.id}</span>
      <span>
        Position: {props.entity.position.x},{props.entity.position.z},{props.entity.position.y}
      </span>
      <span>Authorized players: {props.entity.auth_count}</span>
    </div>
  );
}

function PlayerTooltip(props: { entity: RCON_Player }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <span>
        Player <code>{props.entity.display_name}</code>
      </span>
      <span>Steam ID: {props.entity.id}</span>
      <span>
        Position: {props.entity.position.x},{props.entity.position.z},{props.entity.position.y}
      </span>
      <span>Health: {props.entity.health}</span>
      <span>Address: {props.entity.address}</span>
      <span>Connected: {props.entity.connected_seconds} sec</span>
    </div>
  );
}

type ID = string;
type Discriminated<Discriminator> = { discriminator: Discriminator };
type MapEntity = (RCON_Player & Discriminated<"player">) | (RCON_ToolCupboard & Discriminated<"tc">);
type WorldMapProps = {
  edge_length_px: number;
  markers: { [id: ID]: MapEntity };
  /**
   * Size of the original game world map (.PNG rendered by RCON after issuing
   * command `rendermap`).
   */
  original_rendered_map_edge_length_px: number;
};
function WorldMap(props: WorldMapProps): React.JSX.Element {
  /**
   * It seems Rust renders world map 1000 px bigger than what is the `worldsize`
   * parameter given as `RustDedicated` executable's startup argument.
   */
  const game_world_margin = 1000;
  const world_size = props.original_rendered_map_edge_length_px - game_world_margin;

  return (
    <>
      <p>original_rendered_map_edge_length_px: {props.original_rendered_map_edge_length_px}</p>
      <p>world_size: {world_size} (deduced)</p>
      <div style={{ position: "relative" }}>
        <img
          src="./.local/map_4500_1337.png" // TODO: get image from backend, or ask from user (can be rendered in-game on client side)
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
            game_world_edge_length_meters: world_size,
            game_world_margin,
          }}
        />
      </div>
    </>
  );
}

/**
 * A pseudo element only invisibly rendered to determine the resolution of
 * the game world map .PNG image. Returns the information to parent component
 * via state hook passed in props. From this number we can derive the game world
 * size.
 */
function PseudoMap(props: {
  set_map_size: React.Dispatch<React.SetStateAction<number>>;
  map_src: string;
}): React.JSX.Element {
  return (
    <img
      src={props.map_src}
      style={{
        visibility: "hidden",
        position: "absolute",
      }}
      onLoad={(event) => {
        props.set_map_size((event.target as any).height);
      }}
    ></img>
  );
}

type RDS_Sync_Api = { addr: string; websocket: WebSocket | null };

function send_rcon_command(websocket: WebSocket): void {
  websocket.send("env.time 9");
}

function App(): React.JSX.Element {
  const [rcon_state, set_rcon_state] = React.useState<RCON_State>({
    game_time: 0,
    players: [],
    sync_time_ms: 0,
    tcs: [],
  });
  const [map_size_px, set_map_size_px] = React.useState<number>(NaN);
  const [rds_sync_api, set_rds_sync_api] = React.useState<RDS_Sync_Api>({
    addr: "ws://rds-remote:1234",
    websocket: null,
  });

  // TODO: get the map from some API?
  const map_src = "./.local/map.png";

  const socket_alias_for_typescript = rds_sync_api.websocket; // lol
  const cmd_button = socket_alias_for_typescript === null
    ? null
    : <button onClick={() => send_rcon_command(socket_alias_for_typescript)}>Send command</button>;

  return (
    <>
      {Number.isNaN(map_size_px) && <PseudoMap map_src={map_src} set_map_size={set_map_size_px} />}
      <input
        type="text"
        onChange={(e) => handle_input_rds_sync_api_addr(e, rds_sync_api, set_rds_sync_api)}
        value={rds_sync_api.addr}
      />
      <button
        disabled={rds_sync_api.websocket?.readyState === 1}
        onClick={() => handle_click_connect(rds_sync_api, set_rcon_state, set_rds_sync_api)}
      >
        Connect
      </button>
      {cmd_button}

      <RCONView rcon_state={rcon_state} />
      <WorldMap
        edge_length_px={750}
        markers={make_markers(rcon_state)}
        original_rendered_map_edge_length_px={map_size_px}
      />
    </>
  );
}

async function handle_click_connect(
  rds_sync_api: RDS_Sync_Api,
  set_rcon_state: React.Dispatch<React.SetStateAction<RCON_State>>,
  set_rds_sync_api: React.Dispatch<React.SetStateAction<RDS_Sync_Api>>
): Promise<void> {
  const socket = new WebSocket(rds_sync_api.addr);

  socket.addEventListener("close", function () {
    set_rds_sync_api({
      ...rds_sync_api,
      websocket: null,
    });
  });

  socket.addEventListener("error", function () {
    set_rds_sync_api({
      ...rds_sync_api,
      websocket: null,
    });
  });

  socket.addEventListener("message", function (message) {
    const remote_state = JSON.parse(message.data);
    set_rcon_state(remote_state);
  });

  socket.addEventListener("open", function () {
    set_rds_sync_api({
      ...rds_sync_api,
      websocket: socket,
    });
  });
}

function handle_input_rds_sync_api_addr<Event extends { target: { value: string } }>(
  event: Event,
  state: RDS_Sync_Api,
  set_state: React.Dispatch<React.SetStateAction<RDS_Sync_Api>>
) {
  set_state({
    ...state,
    addr: event.target.value,
  });
}

function make_markers(rcon_state: RCON_State): { [id: ID]: MapEntity } {
  const map: { [id: ID]: MapEntity } = {};

  // TODO: get as a hash map from backend instead!
  for (const player of rcon_state.players)
    map[player.id] = Object.assign(player, { discriminator: "player" } satisfies Discriminated<"player">);

  for (const tc of rcon_state.tcs)
    map[tc.id] = Object.assign(tc, { discriminator: "tc" } satisfies Discriminated<"tc">);

  return map;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
