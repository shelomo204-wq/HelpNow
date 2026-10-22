const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Database = require("better-sqlite3");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

/* =========================================
   CORS - מאפשר לאתר ב-5173 לדבר עם השרת
========================================= */

app.use((req, res, next) => {
  const allowedOrigin =
    req.headers.origin === "http://localhost:5173" ||
    req.headers.origin === "http://127.0.0.1:5173"
      ? req.headers.origin
      : "http://localhost:5173";

  res.header(
    "Access-Control-Allow-Origin",
    allowedOrigin
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================================
   DATABASE
========================================= */

const db = new Database("helpnow.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    owner_id TEXT NOT NULL,
    helper_id TEXT,
    location TEXT DEFAULT 'ראשון לציון',
    latitude REAL DEFAULT 31.973,
    longitude REAL DEFAULT 34.7925,
    created_at TEXT NOT NULL
  );
`);

/* =========================================
   DATABASE MIGRATION
   מתאים גם למסד שכבר נוצר בשלב הקודם
========================================= */

const columns = db
  .prepare(`PRAGMA table_info(requests)`)
  .all()
  .map((column) => column.name);

if (!columns.includes("location")) {
  db.exec(
    `ALTER TABLE requests ADD COLUMN location TEXT DEFAULT 'ראשון לציון'`
  );
}

if (!columns.includes("latitude")) {
  db.exec(
    `ALTER TABLE requests ADD COLUMN latitude REAL DEFAULT 31.973`
  );
}

if (!columns.includes("longitude")) {
  db.exec(
    `ALTER TABLE requests ADD COLUMN longitude REAL DEFAULT 34.7925`
  );
}

console.log("💾 מסד הנתונים מוכן");

/* =========================================
   MESSAGE QUERIES
========================================= */

const saveMessage = db.prepare(`
  INSERT INTO messages (
    room_id,
    sender_id,
    text,
    time
  )
  VALUES (?, ?, ?, ?)
`);

const getMessages = db.prepare(`
  SELECT
    id,
    room_id AS roomId,
    sender_id AS senderId,
    text,
    time
  FROM messages
  WHERE room_id = ?
  ORDER BY id ASC
`);

/* =========================================
   REQUEST QUERIES
========================================= */

const getRequests = db.prepare(`
  SELECT
    id,
    title,
    description,
    category,
    price,
    status,
    owner_id AS ownerId,
    helper_id AS helperId,
    location,
    latitude,
    longitude,
    created_at AS createdAt
  FROM requests
  ORDER BY id DESC
`);

const getRequest = db.prepare(`
  SELECT
    id,
    title,
    description,
    category,
    price,
    status,
    owner_id AS ownerId,
    helper_id AS helperId,
    location,
    latitude,
    longitude,
    created_at AS createdAt
  FROM requests
  WHERE id = ?
`);

const insertRequest = db.prepare(`
  INSERT INTO requests (
    title,
    description,
    category,
    price,
    status,
    owner_id,
    location,
    latitude,
    longitude,
    created_at
  )
  VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
`);

const takeRequestQuery = db.prepare(`
  UPDATE requests
  SET
    status = 'taken',
    helper_id = ?
  WHERE id = ?
  AND status = 'open'
`);

const cancelRequestQuery = db.prepare(`
  UPDATE requests
  SET
    status = 'open',
    helper_id = NULL
  WHERE id = ?
  AND status IN ('open', 'taken')
`);

/* =========================================
   SEED INITIAL REQUESTS
   רק אם אין בכלל משימות במסד
========================================= */

const requestCount = db
  .prepare(`SELECT COUNT(*) AS count FROM requests`)
  .get().count;

if (requestCount === 0) {
  const seedRequest = db.prepare(`
    INSERT INTO requests (
      title,
      description,
      category,
      price,
      status,
      owner_id,
      location,
      latitude,
      longitude,
      created_at
    )
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  seedRequest.run(
    "צריך עזרה בהעברת ארון",
    "צריך להעביר ארון קטן מהבית לרכב.",
    "delivery",
    80,
    "system",
    "ראשון לציון",
    31.973,
    34.7925,
    now
  );

  seedRequest.run(
    "עזרה בהרכבת שולחן",
    "שולחן חדש הגיע ואני צריך עזרה בהרכבה.",
    "assembly",
    100,
    "system",
    "ראשון לציון",
    31.968,
    34.787,
    now
  );

  seedRequest.run(
    "צריך לקנות כמה דברים",
    "צריך מישהו שיקפוץ לסופר ויביא כמה דברים.",
    "shopping",
    60,
    "system",
    "ראשון לציון",
    31.977,
    34.8,
    now
  );

  console.log("🌱 נוספו 3 משימות התחלתיות למסד");
}

/* =========================================
   ROOMS
========================================= */

const rooms = new Map();

function getRoom(roomId) {
  const id = String(roomId);

  if (!rooms.has(id)) {
    rooms.set(id, {
      clients: new Set(),
    });
  }

  return rooms.get(id);
}

/* =========================================
   BASIC SERVER TEST
========================================= */

app.get("/", (req, res) => {
  res.send("HelpNow Server + Database עובד! 🚀");
});

/* =========================================
   GET ALL REQUESTS
========================================= */

app.get("/api/requests", (req, res) => {
  try {
    const rows = getRequests.all();

    const requests = rows.map((request) => ({
      ...request,
      position: [
        Number(request.latitude),
        Number(request.longitude),
      ],
    }));

    res.json(requests);
  } catch (error) {
    console.error(
      "❌ שגיאה בטעינת משימות:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "שגיאה בטעינת המשימות",
    });
  }
});

/* =========================================
   CREATE REQUEST
========================================= */

app.post("/api/requests", (req, res) => {
  try {
    const {
      title,
      description,
      category,
      price,
      ownerId,
      location,
      position,
    } = req.body;

    if (!title || !description || !category || !ownerId) {
      return res.status(400).json({
        success: false,
        error: "חסרים פרטים",
      });
    }

    const numericPrice = Number(price) || 0;

    const safePosition =
      Array.isArray(position) && position.length === 2
        ? position
        : [31.973, 34.7925];

    const safeLocation =
      String(location || "המיקום שלי");

    const createdAt = new Date().toISOString();

    const result = insertRequest.run(
      String(title),
      String(description),
      String(category),
      numericPrice,
      String(ownerId),
      safeLocation,
      Number(safePosition[0]),
      Number(safePosition[1]),
      createdAt
    );

    const row = getRequest.get(
      result.lastInsertRowid
    );

    const request = {
      ...row,
      position: [
        Number(row.latitude),
        Number(row.longitude),
      ],
    };

    console.log(
      `📝 משימה חדשה נשמרה: ${request.id}`
    );

    res.json(request);
  } catch (error) {
    console.error(
      "❌ שגיאה ביצירת משימה:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "שגיאה ביצירת המשימה",
    });
  }
});

/* =========================================
   TAKE REQUEST
========================================= */

app.post("/api/requests/:id/take", (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const helperId = String(
      req.body.helperId || ""
    );

    if (!helperId) {
      return res.status(400).json({
        success: false,
        error: "חסר מזהה משתמש",
      });
    }

    const result = takeRequestQuery.run(
      helperId,
      requestId
    );

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        error: "המשימה כבר נלקחה או אינה זמינה",
      });
    }

    const row = getRequest.get(requestId);

    const request = {
      ...row,
      position: [
        Number(row.latitude),
        Number(row.longitude),
      ],
    };

    console.log(
      `🤝 משימה ${requestId} נלקחה על ידי ${helperId}`
    );

    res.json(request);
  } catch (error) {
    console.error(
      "❌ שגיאה בלקיחת משימה:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "שגיאה בלקיחת המשימה",
    });
  }
});

/* =========================================
   CANCEL REQUEST
========================================= */

app.post("/api/requests/:id/cancel", (req, res) => {
  try {
    const requestId = Number(req.params.id);

    const result = cancelRequestQuery.run(
      requestId
    );

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        error: "לא ניתן לבטל את המשימה",
      });
    }

    const row = getRequest.get(requestId);

    const request = {
      ...row,
      position: [
        Number(row.latitude),
        Number(row.longitude),
      ],
    };

    console.log(
      `↩️ משימה ${requestId} חזרה למצב פתוח`
    );

    res.json(request);
  } catch (error) {
    console.error(
      "❌ שגיאה בביטול משימה:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "שגיאה בביטול המשימה",
    });
  }
});

/* =========================================
   WEBSOCKET CHAT
========================================= */

wss.on("connection", (socket) => {
  console.log("🟢 משתמש התחבר לצ'אט");

  socket.on("message", (rawMessage) => {
    try {
      const data = JSON.parse(
        rawMessage.toString()
      );

      console.log(
        "📩 התקבלה הודעה:",
        data
      );

      if (data.type === "join") {
        const roomId = String(data.roomId);
        const userId = String(data.userId);
        const room = getRoom(roomId);

        socket.roomId = roomId;
        socket.userId = userId;

        room.clients.add(socket);

        const history = getMessages.all(
          roomId
        );

        socket.send(
          JSON.stringify({
            type: "history",
            roomId,
            messages: history,
          })
        );

        console.log(
          `👤 משתמש ${userId} הצטרף לחדר ${roomId}`
        );

        return;
      }

      if (data.type === "chat") {
        const roomId = String(data.roomId);
        const senderId = String(data.senderId);
        const text = String(
          data.text || ""
        ).trim();

        if (!text) {
          return;
        }

        const time = new Date().toISOString();

        const result = saveMessage.run(
          roomId,
          senderId,
          text,
          time
        );

        const message = {
          id: result.lastInsertRowid,
          roomId,
          senderId,
          text,
          time,
        };

        const room = getRoom(roomId);

        room.clients.forEach((client) => {
          if (
            client.readyState ===
            WebSocket.OPEN
          ) {
            client.send(
              JSON.stringify({
                type: "chat",
                ...message,
              })
            );
          }
        });

        console.log(
          `💬 הודעה נשמרה בחדר ${roomId}`
        );
      }
    } catch (error) {
      console.error(
        "❌ שגיאת WebSocket:",
        error.message
      );
    }
  });

  socket.on("close", () => {
    if (
      socket.roomId &&
      rooms.has(socket.roomId)
    ) {
      const room = rooms.get(
        socket.roomId
      );

      room.clients.delete(socket);

      console.log(
        `🔴 משתמש יצא מחדר ${socket.roomId}`
      );
    }

    console.log(
      "🔴 חיבור WebSocket נסגר"
    );
  });

  socket.on("error", (error) => {
    console.error(
      "❌ WebSocket error:",
      error.message
    );
  });
});

/* =========================================
   SERVER
========================================= */

const PORT = 3001;

server.listen(PORT, () => {
  console.log("");
  console.log("================================");
  console.log("🚀 HelpNow Server");
  console.log("💾 SQLite Database");
  console.log("📋 Requests + Chat");
  console.log("================================");
  console.log(
    `🌐 Server: http://localhost:${PORT}`
  );
  console.log(
    `💬 WebSocket: ws://localhost:${PORT}`
  );
  console.log(
    "💾 Database: helpnow.db"
  );
  console.log("================================");
  console.log("");
});
