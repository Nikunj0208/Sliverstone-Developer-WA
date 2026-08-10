import { getEnvironmentValidation } from "./env.js";

const results = getEnvironmentValidation();

for (const result of results) {
  console.log(`${result.name} = ${result.status.toUpperCase()}`);
}

if (results.some((result) => result.status === "missing")) {
  process.exitCode = 1;
}
