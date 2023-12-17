import * as React from "react";
import * as ReactDOM from "react-dom/client";

type RCON_Position = {
  /** Horizontal offset from the map's center. */
  x: number,
  /** Vertical offset from the map's center. */
  y: number,
  /** Altitude. */
  z: number,
}
type RCON_Player = {
  address: string,
  connected_seconds: number,
  display_name: string,
  health: number,
  id: string,
  position: RCON_Position,
};
type RCON_ToolCupboard = {
  id: string,
  position: RCON_Position,
  auth_count: number,
};
type RCON_State = {
  players: Array<RCON_Player>;
  tcs: Array<RCON_ToolCupboard>;
  game_time: number;
  sync_time_ms: number;
};

function RCONView(props: { rcon_state: RCON_State; }) {
  return <div>
    <ul>
      <li>Synced: {props.rcon_state.sync_time_ms}</li>
      <li>Game time: {props.rcon_state.game_time}</li>
      <li>Players: {props.rcon_state.players.length}</li>
      <li>TCs: {props.rcon_state.tcs.length}</li>
    </ul>
  </div>;
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

  return <RCONView rcon_state={rcon_state} />
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
