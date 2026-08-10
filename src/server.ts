import { createApp } from "./app.js";
import { assertEnvironment, env } from "./config/env.js";

assertEnvironment();
const app = createApp();

app.listen(Number.parseInt(env.port, 10), () => {
  console.log(`Silverstone demo listening on port ${env.port}`);
});
