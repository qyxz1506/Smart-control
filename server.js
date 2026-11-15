const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });
const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

server.on("connection", ws => {
  ws.on("message", raw => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "create") {
      const code = crypto.randomInt(100000, 999999).toString();

      rooms.set(code, { master: ws, target: null });

      ws.room = code;
      ws.role = "master";

      send(ws, { type: "created", code });
    }

    if (msg.type === "join") {
      const room = rooms.get(msg.code);

      if (!room || room.target) {
        send(ws, { type: "error", message: "Kode tidak valid atau sudah digunakan" });
        return;
      }

      room.target = ws;
      ws.room = msg.code;
      ws.role = "target";

      send(ws, { type: "joined" });
      send(room.master, { type: "target-connected" });
    }

    if (msg.type === "relay") {
      const room = rooms.get(ws.room);

      if (!room || !room.target || !room.master) return;

      const other = ws === room.master ? room.target : room.master;

      send(other, {
        type: "relay",
        data: msg.data
      });
    }
  });

  ws.on("close", () => {
    const room = rooms.get(ws.room);

    if (room) {
      send(room.master, { type: "disconnected" });
      send(room.target, { type: "disconnected" });
      rooms.delete(ws.room);
    }
  });
});

console.log("SMART CONTROL signaling server berjalan di port 8080");