import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API to save sequence data to JSON files
  app.post("/api/save-sequence", async (req, res) => {
    const { id, data } = req.body;
    
    if (!id || !data) {
      return res.status(400).json({ error: "Missing id or data" });
    }

    // Extract the number from #0, #1, etc.
    const match = id.match(/#(\d+)/);
    if (!match) {
      return res.status(400).json({ error: "Invalid sequence ID format" });
    }

    const seqNum = match[1];
    const filePath = path.join(process.cwd(), "src", "data", `seq${seqNum}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`Successfully saved ${filePath}`);
      res.json({ success: true, message: `Saved to seq${seqNum}.json` });
    } catch (error) {
      console.error(`Error saving file: ${error}`);
      res.status(500).json({ error: "Failed to save file" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
