import axios from "axios";
import { assertEnvironment, env } from "../src/config/env.js";
import { createMetaClient } from "../src/meta/client.js";

async function checkEndpoint(name: string, path: string): Promise<void> {
  const client = createMetaClient();
  try {
    const res = await client.get(path);
    console.info(`[${name}] SUCCESS: HTTP ${res.status}`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const errData = error.response.data as { error?: { code?: number; message?: string; type?: string } };
      console.info(`[${name}] FAILED: HTTP ${error.response.status}`);
      console.info(`  Meta Error Code: ${errData.error?.code ?? "unknown"}`);
      console.info(`  Meta Error Type: ${errData.error?.type ?? "unknown"}`);
      console.info(`  Meta Error Message: ${errData.error?.message ?? "unknown"}`);
    } else {
      console.info(`[${name}] FAILED: Unable to reach endpoint`);
    }
  }
}

async function main(): Promise<void> {
  assertEnvironment();
  console.info("Testing Meta API Endpoints safely...");
  await checkEndpoint("PHONE_NUMBER", `/${env.whatsappPhoneNumberId}`);
  await checkEndpoint("WABA", `/${env.whatsappWabaId}`);
  await checkEndpoint("WABA_SUBSCRIPTIONS", `/${env.whatsappWabaId}/subscribed_apps`);
}

void main();
