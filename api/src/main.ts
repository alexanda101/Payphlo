import dotenv from "dotenv";
import { createApp } from "./app";
import { validateStartupEnv } from "./lib/env";

dotenv.config();
validateStartupEnv();

const app = createApp();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`API running on http://${HOST}:${PORT}`);
});
