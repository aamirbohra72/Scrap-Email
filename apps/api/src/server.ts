import { getEnv, loadEnv } from "@repo/config";

loadEnv();

import { createApp } from "./app.js";
import { log } from "./middleware/logger.js";

const { PORT } = getEnv();
const app = createApp();
const port = Number.parseInt(PORT, 10);

app.listen(port, () => {
  log("info", "server_listening", { port });
});
