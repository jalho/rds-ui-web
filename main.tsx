import * as React from "react";
import * as ReactDOM from "react-dom/client";

type RCON_Position = {
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
}): React.JSX.Element[] {
  const elements = Object.values(props.data).map(function (entity) {
    return (
      <div
        style={{
          backgroundColor: "red",
          width: props.size_px,
          height: props.size_px,
          position: "absolute",
        }}
      ></div>
    );
  });

  return elements;
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
      </div>
      <Markers data={props.markers} size_px={10} />
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
      <WorldMap edge_length_px={100} markers={make_markers(rcon_state)} />
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
