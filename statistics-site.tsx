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
import * as ramda from "ramda";

function use_websocket_message(websocket: WebSocket): MessageStatsInit | MessageStatsIncrement {
  const [message, set_message] = React.useState<MessageStatsInit | MessageStatsIncrement>({});
  React.useEffect(() => {
    websocket.addEventListener("message", function handle_message(event) {
      set_message(JSON.parse(event.data));
    });
  }, []);
  return message;
}

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
 * For example:
 * `"assets/bundled/prefabs/autospawn/collectable/hemp/hemp-collectable.prefab"`
 *  -> `"hemp-collectable.prefab"`
 */
function trim_object_id(id: string): string {
  const slash_idx = id.lastIndexOf("/");
  if (slash_idx < 0) {
    return id;
  } else {
    return id.substring(slash_idx + 1);
  }
}

/**
 * Manage WebSocket connection and render accordingly.
 */
function ContainConnectedWs(props: {
  view_connected: (websocket: WebSocket) => React.JSX.Element;
  view_disconnected: React.JSX.Element;
}): React.JSX.Element {
  const [connection_state, set_connection_state] = React.useState<ConnectionState>({
    socket_ref: null,
    socket_state: WebSocketState.CLOSED,
    interval_keepalive: null,
  });

  /*
   * Connect when disconnected.
   */
  React.useEffect(
    function connect_websocket() {
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
    },
    [connection_state.socket_state]
  );

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

function is_MessageStatsIncrement(n: MessageStatsInit | MessageStatsIncrement): n is MessageStatsIncrement {
  return "category" in n;
}

function update_or_init_nested_property<T, V>(obj: T, ramda_lens_path: ramda.Path, value_assignable: V) {
  const lens = ramda.lensPath(ramda_lens_path);
  const obj_updated = ramda.set(lens, value_assignable, obj);
  return obj_updated;
}

function ViewConnected(props: { websocket: WebSocket }): React.JSX.Element {
  const [data_state, set_data_state] = React.useState<MessageStatsInit>({});
  const message: MessageStatsInit | MessageStatsIncrement = use_websocket_message(props.websocket);

  // request for inital state
  React.useEffect(function request_initial_state() {
    props.websocket.send("init");
  }, []);

  React.useEffect(
    function increment_data_state() {
      // initialize state
      if (!is_MessageStatsIncrement(message)) {
        set_data_state(message);
      }

      // increment state
      else {
        const old_quantity = data_state[message.id_subject]?.[message.id_object]?.Quantity ?? 0;
        set_data_state(
          update_or_init_nested_property(
            data_state,
            [message.id_subject, message.id_object, "Quantity"],
            old_quantity + message.quantity
          )
        );
      }
    },
    [message]
  );

  return (
    <>
      <ObjectList data={data_state} />
      <PlayerList data={data_state} />
    </>
  );
}

function ObjectList(props: { data: MessageStatsInit }): React.JSX.Element {
  return <>TODO: Top-5 lists of each resource here...</>;
}

function PlayerList(props: { data: MessageStatsInit }): React.JSX.Element {
  return (
    <>
      {Object.entries(props.data).map(function make_player_stats([subject_id, stats]) {
        return <SubjectStats key={subject_id} subject_id={subject_id} stats={stats} />;
      })}
    </>
  );
}

function PlayerPlacard(props: { player_id: string }): React.JSX.Element {
  // TODO: use some metadata fetcher HOC and view player display name etc.
  return (
    <h1>
      Steam ID: <code>{props.player_id}</code>
    </h1>
  );
}

function ObjectPlacard(props: { object_id: string }): React.JSX.Element {
  // TODO: use some decoration fetcher HOC and view resource thumbnail image or something
  return (
    <h2>
      object ID: <code>{trim_object_id(props.object_id)}</code> (trimmed)
    </h2>
  );
}

function SubjectStats(props: { stats: MessageStatsInit[string]; subject_id: string }): React.JSX.Element {
  return (
    <div>
      <PlayerPlacard player_id={props.subject_id} />
      {Object.entries(props.stats).map(function make_object_stats([object_id, stats]) {
        return <ObjectStats key={object_id} object_id={object_id} stats={stats} />;
      })}
    </div>
  );
}

function ObjectStats(props: { stats: MessageStatsInit[string][string]; object_id: string }): React.JSX.Element {
  return (
    <div>
      <ObjectPlacard object_id={props.object_id} />
      <code>{props.stats.Quantity}</code>
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <ContainConnectedWs
      view_connected={(websocket) => <ViewConnected websocket={websocket} />}
      view_disconnected={<>Diconnected</>}
    />
  );
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
