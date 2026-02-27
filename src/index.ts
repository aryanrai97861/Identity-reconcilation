import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import identifyRouter from "./routes/identify";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/identify", identifyRouter);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
