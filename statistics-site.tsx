/*

# Cheatsheet

## Serve with esbuild

```
node_modules/typescript/bin/tsc && node_modules/esbuild/bin/esbuild statistics-site.tsx --bundle --outfile=bundle.js --bundle --servedir=$(pwd) --watch
```

## Build

```
git clean -fdx
npm ci
node_modules/typescript/bin/tsc && node_modules/esbuild/bin/esbuild statistics-site.tsx --bundle --outfile=bundle.js
```

## Deploy

```
scp bundle.js rust:/var/www/html/ && scp index.html rust:/var/www/html/
```

*/

import * as React from "react";
import * as ReactDOM from "react-dom/client";

type MessageStatsIncrement = {
  /**
   * Enum. See the Carbon plugin ('activity_sock') and/or rds-stats-sink
   * thingy. TODO: Use category as type discriminator!
   */
  category: number;
  /**
   * Unix timestamp (in seconds) of when the event occurred.
   */
  timestamp: number;
  /**
   * 17-digit Steam ID of the event's subject as string. E.g. the farming
   * player's ID.
   */
  id_subject: string;
  /**
   * E.g. "wood" when a player farmed wood.
   */
  id_object: string;
  /**
   * How much of e.g. wood was collected.
   */
  quantity: number;
};

type MessageStatsInit = Record<
  string, // 17-digit Steam ID of a player
  Record<
    string, // farm object, e.g. "wood"
    { Quantity: number; Timestamp_unix_sec_init: number; Timestamp_unix_sec_latest: number }
  >
>;

enum WebSocketState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

type ConnectionState = {
  socket_ref: WebSocket | null;
  socket_state: WebSocketState;
  interval_keepalive: number | null;
};

/**
 * Manage WebSocket connection and render accordingly.
 */
function ContainConnectedWs(props: {
  view_connected: (websocket: WebSocket) => React.JSX.Element,
  view_disconnected: React.JSX.Element,
}): React.JSX.Element {
  const [connection_state, set_connection_state] = React.useState<ConnectionState>({
    socket_ref: null,
    socket_state: WebSocketState.CLOSED,
    interval_keepalive: null,
  });

  /*
   * Connect when disconnected.
   */
  React.useEffect(function connect_websocket() {
    console.debug("Connection state changed! State is now: %s", WebSocketState[connection_state.socket_state]);
    if (connection_state.socket_state > WebSocketState.OPEN) {
      const websocket = new WebSocket("/sock/stats");
      websocket.addEventListener("open", function store_ref() {
        /*
         * Send keepalive probes to keep proxied WebSocket connection open.
         * Nginx closes the tunnel after 1 minute of no traffic, and I tend to
         * deploy stuff behind Nginx.
         */
        const interval_keepalive = setInterval(function probe_keepalive() {
          /*
           * Actual ping (as in WebSocket protocol) is not implemented in
           * browsers... But that's fine because any traffic over TCP will
           * suffice for our purposes!
           */
          websocket.send("not ping");
        }, 30000) as any;
        set_connection_state({ socket_ref: websocket, socket_state: websocket.readyState, interval_keepalive });
      });
      websocket.addEventListener("close", function remove_ref() {
        if (connection_state.interval_keepalive) clearInterval(connection_state.interval_keepalive);
        set_connection_state({ socket_ref: null, socket_state: websocket.readyState, interval_keepalive: null });
      });
    }
  }, [connection_state.socket_state]);

  switch (connection_state.socket_state) {
    case WebSocketState.OPEN: {
      return props.view_connected(connection_state.socket_ref as WebSocket);
    }
    case WebSocketState.CONNECTING:
    case WebSocketState.CLOSING:
    case WebSocketState.CLOSED:
    default: {
      return props.view_disconnected;
    }
  }
}

function ViewConnected(props: { websocket: WebSocket }): React.JSX.Element {
  const [data_state, set_data_state] = React.useState<unknown>(null);

  React.useEffect(function get_initial_data_state() {
    props.websocket.addEventListener("message", function initialize(event) {
      const message: MessageStatsInit | MessageStatsIncrement = JSON.parse(event.data);
      if ("category" in message) {
        console.debug("Got a stats increment message!", message);
        // TODO: Apply incremental state updates after initial state!
      } else {
        console.debug("Got a stats init message!", message);
        set_data_state(event.data);
      }
    });
    props.websocket.send("init");
  }, []);

  return <>Connected -- data_state: {data_state}</>;
}

function App(): React.JSX.Element {
  return <ContainConnectedWs view_connected={(websocket) => <ViewConnected websocket={websocket} />} view_disconnected={<>Diconnected</>} />;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
