import * as React from "react";
import * as ReactDOM from "react-dom/client";

function App(): React.JSX.Element {
  const socket = new WebSocket("ws://rds-remote:1234");
  socket.addEventListener("close", console.log);
  socket.addEventListener("error", console.log);
  socket.addEventListener("message", console.log);
  socket.addEventListener("open", console.log);

  return <>This is React</>;
}

const root_node = document.getElementById("root");
if (root_node) {
  ReactDOM.createRoot(root_node).render(<App />);
}
