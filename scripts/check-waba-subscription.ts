import axios from "axios";

import { assertEnvironment, env } from "../src/config/env.js";
import { createMetaClient } from "../src/meta/client.js";

type SubscribedApp = {
  id?: unknown;
};

type SubscribedAppsResponse = {
  data?: unknown;
};

function subscribedAppIds(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const app = item as { id?: unknown; whatsapp_business_api_data?: { id?: unknown } };
    const id = app.whatsapp_business_api_data?.id ?? app.id;
    return typeof id === "string" ? [id] : [];
  });
}

async function main(): Promise<void> {
  assertEnvironment();

  try {
    const response = await createMetaClient().get<SubscribedAppsResponse>(
      `/${env.whatsappWabaId}/subscribed_apps`
    );
    const appIds = subscribedAppIds(response.data.data);

    console.info("WABA SUBSCRIPTION CHECK: SUCCESS");
    console.info(`CURRENT APP SUBSCRIBED: ${appIds.includes(env.metaAppId) ? "YES" : "NO"}`);
  } catch (error: unknown) {
    console.info("WABA SUBSCRIPTION CHECK: FAILED");

    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as { error?: { code?: unknown; message?: unknown } };
      const metaError = data.error;
      console.info(`HTTP STATUS: ${error.response.status}`);
      console.info(`META ERROR CODE: ${typeof metaError?.code === "number" ? metaError.code : "UNAVAILABLE"}`);
      console.info(
        `META ERROR MESSAGE: ${typeof metaError?.message === "string" ? metaError.message : "UNAVAILABLE"}`
      );
      process.exitCode = 1;
      return;
    }

    console.info("HTTP STATUS: UNAVAILABLE");
    console.info("META ERROR CODE: UNAVAILABLE");
    console.info("META ERROR MESSAGE: Unable to contact Meta API.");
    process.exitCode = 1;
  }
}

void main();
