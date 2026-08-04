const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    game: "FF22",
    message: "Servidor FF22 funcionando"
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online"
  });
});

app.get("/live/", (req, res) => {
  res.json({
    ok: true,
    game: "FF22",
    status: "online",
    version: "1.0.0"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FF22 server running on port ${PORT}`);
});
