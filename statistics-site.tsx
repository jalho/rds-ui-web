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

enum MessageCategory {
  PvP = 0,
  PvE,
  Farm,
  World,
}

type MessageStatsIncrement = {
  /**
   * Enum. See the Carbon plugin ('activity_sock') and/or rds-stats-sink
   * thingy. TODO: Use category as type discriminator!
   */
  category: MessageCategory;
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

type StatsStore<Stat> = Record<
  string, // 17-digit Steam ID of a player
  Record<
    string, // farm object, e.g. "wood"
    Stat
  >
>;

type MessageStatsInit = StatsStore<{
  Quantity: number;
  Timestamp_unix_sec_init: number;
  Timestamp_unix_sec_latest: number;
}>;
type StatsLocal = StatsStore<{
  Quantity: number;
  Timestamp_unix_sec_init: number;
  Timestamp_unix_sec_latest: number;
  received_at: number;
}>;

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

function get_log_timestamp(timestamp: Date): string {
  return timestamp.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function ViewConnected(props: { websocket: WebSocket }): React.JSX.Element {
  const [data_state, set_data_state] = React.useState<StatsLocal>({});
  const [message_log, set_message_log] = React.useState<Array<string>>([]);
  const message: MessageStatsInit | MessageStatsIncrement = use_websocket_message(props.websocket);

  // request for inital state
  React.useEffect(function request_initial_state() {
    props.websocket.send("init");
  }, []);

  React.useEffect(
    function handle_message() {
      const now_timestamp = Date.now();

      // initialize state
      if (!is_MessageStatsIncrement(message)) {
        for (const [id_subject, subject_stats] of Object.entries(message as StatsLocal)) {
          for (const [id_object, stats] of Object.entries(subject_stats)) {
            stats.received_at = now_timestamp;
          }
        }
        set_data_state(message as StatsLocal);
      }

      // increment state
      else if (message.category === MessageCategory.Farm) {
        const log = [
          ...message_log,
          `[${get_log_timestamp(new Date(message.timestamp * 1000))}] ${MessageCategory[MessageCategory.Farm]}: ${
            message.id_subject
          } -> ${trim_object_id(message.id_object)}: ${message.quantity}`,
        ];
        if (log.length >= 10) {
          set_message_log(log.slice(-10));
        } else {
          set_message_log(log);
        }

        const old_quantity = data_state[message.id_subject]?.[message.id_object]?.Quantity ?? 0;
        set_data_state(
          update_or_init_nested_property(data_state, [message.id_subject, message.id_object], {
            Quantity: old_quantity + message.quantity,
            Timestamp_unix_sec_latest: message.timestamp,
            received_at: now_timestamp,
          })
        );
      }
    },
    [message]
  );

  return (
    <>
      <section>
        <h1>Some real time stats</h1>
        <p>These stats update in real time without having to reload the page.</p>
        <p>
          The stats are not written to disk, but are instead only kept in memory. The process will restart and thus wipe
          the stats upon the regular (weekly) map wipes.
        </p>
      </section>

      {/*
      <section>
        <h1>Latest activity</h1>
        <MessageLog log={message_log} />
      </section>
      */}

      <section>
        <div className="horizontal">
          <ObjectList data={data_state} />
          <PlayerList data={data_state} />
        </div>
      </section>
    </>
  );
}

function MessageLog(props: { log: Array<string> }): React.JSX.Element {
  return (
    <code className="message-log">
      {props.log.map((n) => {
        return <span key={n}>{n}</span>;
      })}
    </code>
  );
}

function get_players_per_object_sorted(
  players_data: StatsLocal
): Record<string, Array<{ player_id: string; quantity: number; received_at: number }>> {
  const result: ReturnType<typeof get_players_per_object_sorted> = {};

  for (const [player_id, object_stats] of Object.entries(players_data)) {
    for (const [object_id, stats] of Object.entries(object_stats)) {
      if (!result[object_id]) {
        result[object_id] = [{ player_id, quantity: stats.Quantity, received_at: stats.received_at }];
      } else {
        result[object_id].push({ player_id, quantity: stats.Quantity, received_at: stats.received_at });
      }
    }
  }
  for (const player_list of Object.values(result)) {
    player_list.sort(function sort_by_quantity_descending(a, b) {
      return b.quantity - a.quantity;
    });
  }

  return result;
}

function ObjectList(props: { data: StatsLocal }): React.JSX.Element {
  const players_per_object_sorted = get_players_per_object_sorted(props.data);

  const [filter, set_filter] = React.useState<string>("");
  let objects = Object.entries(players_per_object_sorted).sort((a, b) => a[0].localeCompare(b[0]));
  if (filter.length > 0) {
    objects = objects.filter(function apply_filter([object_id]) {
      return object_id.includes(filter);
    });
  }

  return (
    <div className="vertical">
      <h1>Players per object</h1>

      <p>
        Each collected object in alphabetical order, and for each object its collecting players by quantity in
        descending order.
      </p>

      <div className="list-filter-controls">
        <label htmlFor="filter_per_objectid">Filter per object ID:</label>
        <input
          type="text"
          id="filter_per_objectid"
          name="filter_per_objectid"
          value={filter}
          onChange={function handle_change(event) {
            set_filter(event.target.value);
          }}
        />
      </div>

      <div className="stats-list">
        {objects.map(function make_object_toplist([object_id, player_toplist]) {
          return (
            <div key={object_id} className="object">
              <ObjectPlacard object_id={object_id} />
              <ol>
                {player_toplist.map((item) => {
                  return (
                    <HiglightableOnUpdate key={item.player_id} stats={item}>
                      <li>
                        <PlayerPlacard player_id={item.player_id} />:{" "}
                        <code className="significant-value">{item.quantity}</code>
                      </li>
                    </HiglightableOnUpdate>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HiglightableOnUpdate<T extends { received_at: number }>(props: {
  stats: T;
  children: React.JSX.Element;
}): React.JSX.Element {
  const [now_timestamp, set_now_timestamp] = React.useState<number>(Date.now());
  React.useEffect(() => {
    const timerID = setInterval(() => {
      set_now_timestamp(Date.now());
    }, 1000);
    return () => clearInterval(timerID);
  }, []);

  let style_classes = "";
  const delta = Math.abs(props.stats.received_at - now_timestamp);
  if (delta < 3000) style_classes = "recently-changed-value";

  return (
    <>
      <div className={style_classes}>{props.children}</div>
    </>
  );
}

function PlayerList(props: { data: StatsLocal }): React.JSX.Element {
  const [filter, set_filter] = React.useState<string>("");
  let players = Object.entries(props.data);
  if (filter.length > 0) {
    players = players.filter(function apply_filter([player_id]) {
      return player_id.includes(filter);
    });
  }

  return (
    <div className="vertical">
      <h1>Objects per player</h1>
      <p>Each player's collected objects sorted by quantity in descending order.</p>
      <div className="list-filter-controls">
        <label htmlFor="filter_per_player_steamid">Filter per player Steam ID:</label>
        <input
          type="text"
          id="filter_per_player_steamid"
          name="filter_per_player_steamid"
          value={filter}
          onChange={function handle_change(event) {
            set_filter(event.target.value);
          }}
        />
      </div>
      <div className="stats-list">
        {players.map(function make_player_stats([subject_id, stats]) {
          return (
            <div key={subject_id} className="player">
              <SubjectStats subject_id={subject_id} stats={stats} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerPlacard(props: { player_id: string }): React.JSX.Element {
  // TODO: use some metadata fetcher HOC and view player display name etc.
  return (
    <>
      Steam ID: <code>{props.player_id}</code>
    </>
  );
}

function ObjectPlacard(props: { object_id: string }): React.JSX.Element {
  // TODO: use some decoration fetcher HOC and view resource thumbnail image or something
  return (
    <>
      <code>{trim_object_id(props.object_id)}</code>
    </>
  );
}

function SubjectStats(props: { stats: StatsLocal[string]; subject_id: string }): React.JSX.Element {
  return (
    <div>
      <PlayerPlacard player_id={props.subject_id} />
      <ul>
        {Object.entries(props.stats)
          .sort((a, b) => b[1].Quantity - a[1].Quantity)
          .map(function make_object_stats([object_id, stats]) {
            return (
              <li key={object_id}>
                <ObjectStats object_id={object_id} stats={stats} show_date={false} />
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function ObjectStats(props: {
  stats: StatsLocal[string][string];
  object_id: string;
  show_date: boolean;
}): React.JSX.Element {
  const date: React.JSX.Element = !props.show_date ? (
    <></>
  ) : (
    <>
      {` at ${new Date(props.stats.Timestamp_unix_sec_latest * 1000).toLocaleString(undefined, {
        timeStyle: "medium",
        dateStyle: "short",
      })}`}
    </>
  );

  return (
    <HiglightableOnUpdate stats={props.stats}>
      <>
        <ObjectPlacard object_id={props.object_id} />: <code className="significant-value">{props.stats.Quantity}</code>
        {date}
      </>
    </HiglightableOnUpdate>
  );
}

function App(): React.JSX.Element {
  return (
    <ContainConnectedWs
      view_connected={(websocket) => <ViewConnected websocket={websocket} />}
      view_disconnected={<>Disconnected</>}
    />
  );
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
