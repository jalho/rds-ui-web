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

function App(): React.JSX.Element {
  const websocket = new WebSocket("/sock/stats");
  websocket.addEventListener("message", handle_message_stats);
  websocket.addEventListener("close", console.log);
  websocket.addEventListener("open", (asd) => {
    console.log(asd);
    websocket.send("init");
  });
  return <>Reindeerland</>;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
