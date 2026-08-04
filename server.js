const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "FF22-CHANGE-THIS-IN-RENDER";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}

app.use(cors());
app.use(express.json());

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(users, null, 2)
  );
}

function createPlayerId(users) {
  let playerId;

  do {
    playerId = String(
      Math.floor(100000000 + Math.random() * 900000000)
    );
  } while (users.some(u => u.playerId === playerId));

  return playerId;
}

function publicUser(user) {
  return {
    playerId: user.playerId,
    username: user.username,
    coins: user.coins,
    inventory: user.inventory,
    equipped: user.equipped,
    createdAt: user.createdAt
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      playerId: user.playerId
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "AUTH_REQUIRED"
    });
  }

  const token = header.substring(7);

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      ok: false,
      error: "INVALID_TOKEN"
    });
  }
}

/* =========================
   SERVER
========================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    game: "FF22",
    server: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online"
  });
});

/* =========================
   VERSION / LIVE
========================= */

app.get("/live/", (req, res) => {
  res.json({
    ok: true,
    game: "FF22",
    status: "online",
    version: "1.0.0",
    maintenance: false
  });
});

/* =========================
   CONFIG
========================= */

app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    game: "FF22",
    version: "1.0.0",
    maintenance: false,

    features: {
      login: true,
      inventory: true,
      shop: true,
      rewards: true,
      profile: true,
      lobby: true
    }
  });
});

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {
  try {
    const username = String(
      req.body.username || ""
    ).trim().toLowerCase();

    const password = String(
      req.body.password || ""
    );

    if (username.length < 3) {
      return res.status(400).json({
        ok: false,
        error: "USERNAME_TOO_SHORT"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "PASSWORD_TOO_SHORT"
      });
    }

    const users = getUsers();

    if (users.some(u => u.username === username)) {
      return res.status(409).json({
        ok: false,
        error: "USERNAME_EXISTS"
      });
    }

    const user = {
      id: crypto.randomUUID(),

      playerId: createPlayerId(users),

      username,

      passwordHash: await bcrypt.hash(
        password,
        12
      ),

      coins: 1000,

      inventory: [],

      equipped: {
        character: null,
        outfit: null,
        backpack: null,
        emote: null
      },

      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    res.status(201).json({
      ok: true,

      token: createToken(user),

      player: publicUser(user)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "SERVER_ERROR"
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const username = String(
      req.body.username || ""
    ).trim().toLowerCase();

    const password = String(
      req.body.password || ""
    );

    const users = getUsers();

    const user = users.find(
      u => u.username === username
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "INVALID_LOGIN"
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: "INVALID_LOGIN"
      });
    }

    res.json({
      ok: true,
      token: createToken(user),
      player: publicUser(user)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "SERVER_ERROR"
    });
  }
});

/* =========================
   PROFILE
========================= */

app.get("/api/me", authenticate, (req, res) => {
  const users = getUsers();

  const user = users.find(
    u => u.id === req.auth.id
  );

  if (!user) {
    return res.status(404).json({
      ok: false,
      error: "PLAYER_NOT_FOUND"
    });
  }

  res.json({
    ok: true,
    player: publicUser(user)
  });
});

/* =========================
   INVENTORY
========================= */

app.get(
  "/api/inventory",
  authenticate,
  (req, res) => {
    const users = getUsers();

    const user = users.find(
      u => u.id === req.auth.id
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "PLAYER_NOT_FOUND"
      });
    }

    res.json({
      ok: true,
      inventory: user.inventory,
      equipped: user.equipped
    });
  }
);

/* =========================
   ADD ITEM
========================= */

app.post(
  "/api/inventory/add",
  authenticate,
  (req, res) => {
    const itemId = String(
      req.body.itemId || ""
    ).trim();

    if (!itemId) {
      return res.status(400).json({
        ok: false,
        error: "ITEM_REQUIRED"
      });
    }

    const users = getUsers();

    const user = users.find(
      u => u.id === req.auth.id
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "PLAYER_NOT_FOUND"
      });
    }

    if (!user.inventory.includes(itemId)) {
      user.inventory.push(itemId);
    }

    saveUsers(users);

    res.json({
      ok: true,
      inventory: user.inventory
    });
  }
);

/* =========================
   EQUIP ITEM
========================= */

app.post(
  "/api/inventory/equip",
  authenticate,
  (req, res) => {
    const type = String(
      req.body.type || ""
    );

    const itemId = String(
      req.body.itemId || ""
    );

    const allowed = [
      "character",
      "outfit",
      "backpack",
      "emote"
    ];

    if (!allowed.includes(type)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_EQUIP_TYPE"
      });
    }

    const users = getUsers();

    const user = users.find(
      u => u.id === req.auth.id
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "PLAYER_NOT_FOUND"
      });
    }

    if (!user.inventory.includes(itemId)) {
      return res.status(400).json({
        ok: false,
        error: "ITEM_NOT_OWNED"
      });
    }

    user.equipped[type] = itemId;

    saveUsers(users);

    res.json({
      ok: true,
      equipped: user.equipped
    });
  }
);

/* =========================
   COINS
========================= */

app.get(
  "/api/coins",
  authenticate,
  (req, res) => {
    const users = getUsers();

    const user = users.find(
      u => u.id === req.auth.id
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "PLAYER_NOT_FOUND"
      });
    }

    res.json({
      ok: true,
      coins: user.coins
    });
  }
);

/* =========================
   LOBBY
========================= */

app.get(
  "/api/lobby",
  authenticate,
  (req, res) => {
    const users = getUsers();

    const user = users.find(
      u => u.id === req.auth.id
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "PLAYER_NOT_FOUND"
      });
    }

    res.json({
      ok: true,

      lobby: {
        playerId: user.playerId,

        onlinePlayers: users.length,

        status: "ready"
      }
    });
  }
);

/* =========================
   404
========================= */

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "ENDPOINT_NOT_FOUND"
  });
});

/* =========================
   START
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `FF22 server running on port ${PORT}`
  );
});
