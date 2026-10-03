import axios from "axios";

import { assertEnvironment, env } from "../src/config/env.js";
import { createMetaClient } from "../src/meta/client.js";

type SubscribedAppsResponse = {
  data?: unknown;
};

function isCurrentAppSubscribed(data: unknown): boolean {
  if (!Array.isArray(data)) {
    return false;
  }

  return data.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const app = item as { id?: unknown; whatsapp_business_api_data?: { id?: unknown } };
    const id = app.whatsapp_business_api_data?.id ?? app.id;
    return id === env.metaAppId;
  });
}

function reportMetaError(error: unknown): void {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as { error?: { code?: unknown; message?: unknown } };
    const metaError = data.error;
    console.info(`HTTP STATUS: ${error.response.status}`);
    console.info(`META ERROR CODE: ${typeof metaError?.code === "number" ? metaError.code : "UNAVAILABLE"}`);
    console.info(
      `META ERROR MESSAGE: ${typeof metaError?.message === "string" ? metaError.message : "UNAVAILABLE"}`
    );
    return;
  }

  console.info("HTTP STATUS: UNAVAILABLE");
  console.info("META ERROR CODE: UNAVAILABLE");
  console.info("META ERROR MESSAGE: Unable to contact Meta API.");
}

async function main(): Promise<void> {
  assertEnvironment();
  const client = createMetaClient();

  try {
    const response = await client.post(`/${env.whatsappWabaId}/subscribed_apps`);
    console.info("SUBSCRIBE API REQUEST: SUCCESS");
    console.info(`HTTP STATUS: ${response.status}`);
  } catch (error: unknown) {
    console.info("SUBSCRIBE API REQUEST: FAILED");
    reportMetaError(error);
    process.exitCode = 1;
    return;
  }

  try {
    const response = await client.get<SubscribedAppsResponse>(
      `/${env.whatsappWabaId}/subscribed_apps`
    );
    console.info(
      `CURRENT APP SUBSCRIBED TO WABA: ${isCurrentAppSubscribed(response.data.data) ? "YES" : "NO"}`
    );
  } catch (error: unknown) {
    console.info("CURRENT APP SUBSCRIBED TO WABA: NO");
    reportMetaError(error);
    process.exitCode = 1;
  }
}

void main();
