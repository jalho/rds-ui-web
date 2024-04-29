/*

# Cheatsheet

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

function handle_message_stats(event: MessageEvent) {
  const message: MessageStatsInit | MessageStatsIncrement = JSON.parse(event.data);
  if ("category" in message) {
    console.debug("Got a stats increment message!", message);
  } else {
    console.debug("Got a stats init message!", message);
  }
}

enum WebSocketState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

type ConnectionState = { socket_ref: WebSocket | null, socket_state: WebSocketState };

function ContainConnectedWs(props: Record<"view_connected" | "view_disconnected", React.JSX.Element>): React.JSX.Element {
  const [connection_state, set_connection_state] = React.useState<ConnectionState>({
    socket_ref: null,
    socket_state: WebSocketState.CLOSED
  });

  React.useEffect(function connect_websocket() {
    console.debug("Connection state changed! State is now: %s", WebSocketState[connection_state.socket_state]);
    if (connection_state.socket_state > WebSocketState.OPEN) {
      const websocket = new WebSocket("/sock/stats");
      websocket.addEventListener("open", function store_ref() {
        set_connection_state({ ...connection_state, socket_state: websocket.readyState });
      });
      websocket.addEventListener("close", function remove_ref() {
        set_connection_state({ socket_ref: null, socket_state: websocket.readyState });
      });
    }
  }, [connection_state.socket_state]);

  switch (connection_state.socket_state) {
    case WebSocketState.OPEN: {
      return props.view_connected;
    }
    case WebSocketState.CONNECTING:
    case WebSocketState.CLOSING:
    case WebSocketState.CLOSED:
    default: {
      return props.view_disconnected;
    }
  }
}

function ViewConnected(): React.JSX.Element {
  // TODO: Send "init" message over the WebSocket to receive initial state update!
  // TODO: Receive incremental state updates after initial state!
  return <>Connected</>;
}

function App(): React.JSX.Element {
  // TODO: Current setup closes socket after 1 minute of no traffic (Nginx TCP
  // socket timeout) -- Fix by pinging regularly? (Assuming the Go server
  // responds with pongs...)
  return <ContainConnectedWs view_connected={<ViewConnected />} view_disconnected={<>Diconnected</>} />;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
