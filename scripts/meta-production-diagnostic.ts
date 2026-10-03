import axios, { type AxiosError } from "axios";
import { assertEnvironment, env } from "../src/config/env.js";

type DebugTokenResponse = {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    expires_at?: number;
    data_access_expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    user_id?: string;
    error?: {
      code?: number;
      subcode?: number;
      message?: string;
    };
  };
};

type AppResponse = {
  id?: string;
  name?: string;
};

type WabaResponse = {
  id?: string;
  name?: string;
  phone_numbers?: {
    data?: Array<{ id?: string; display_phone_number?: string }>;
  };
};

type PhoneNumberResponse = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
};

function redactSecrets(text: string): string {
  let sanitized = text;
  if (env.metaAccessToken) {
    sanitized = sanitized.split(env.metaAccessToken).join("[REDACTED_ACCESS_TOKEN]");
  }
  if (env.metaAppSecret) {
    sanitized = sanitized.split(env.metaAppSecret).join("[REDACTED_APP_SECRET]");
  }
  return sanitized;
}

function parseMetaError(error: unknown): {
  status: number | string;
  code: number | string;
  subcode: number | string;
  type: string;
  message: string;
} {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as {
      error?: {
        code?: number;
        error_subcode?: number;
        type?: string;
        message?: string;
      };
    };
    const err = data.error;
    return {
      status: error.response.status,
      code: err?.code ?? "NONE",
      subcode: err?.error_subcode ?? "NONE",
      type: err?.type ?? "UNKNOWN",
      message: redactSecrets(err?.message ?? "No error message provided")
    };
  }

  const message = error instanceof Error ? error.message : "Unknown network error";
  return {
    status: "UNREACHABLE",
    code: "NETWORK_ERROR",
    subcode: "NONE",
    type: "NetworkException",
    message: redactSecrets(message)
  };
}

async function main(): Promise<void> {
  console.info("==================================================");
  console.info("META PRODUCTION AUTHENTICATION DIAGNOSTIC");
  console.info("==================================================");

  try {
    assertEnvironment();
    console.info("Configuration check: PASS (All required variables present)");
  } catch (error) {
    console.error("Configuration check: FAIL");
    console.error(error instanceof Error ? error.message : "Missing environment variables");
    process.exitCode = 1;
    return;
  }

  const baseUrl = `https://graph.facebook.com/${env.metaGraphApiVersion}`;
  const appToken = `${env.metaAppId}|${env.metaAppSecret}`;

  let authPass = false;
  let appPass = false;
  let tokenType = "UNKNOWN";
  let tokenValid = false;
  let permissionsPass = false;
  let wabaPass = false;
  let phonePass = false;
  let phoneMatch = false;

  // 1. Check App status using App Access Token
  console.info("\n[1/5] Checking Meta App accessibility...");
  try {
    const appRes = await axios.get<AppResponse>(
      `${baseUrl}/${env.metaAppId}?access_token=${encodeURIComponent(appToken)}`,
      { timeout: 10_000 }
    );
    if (appRes.data.id === env.metaAppId) {
      appPass = true;
      console.info(`META APP = PASS (Name: ${appRes.data.name ?? "Configured App"})`);
    } else {
      console.info("META APP = FAIL (App ID mismatch)");
    }
  } catch (error) {
    const err = parseMetaError(error);
    console.info(`META APP = BLOCKED (HTTP ${err.status})`);
    console.info(`  Meta Error Code: ${err.code}`);
    console.info(`  Meta Error Subcode: ${err.subcode}`);
    console.info(`  Meta Error Type: ${err.type}`);
    console.info(`  Meta Error Message: ${err.message}`);
  }

  // 2. Inspect Token via /debug_token
  console.info("\n[2/5] Inspecting Access Token metadata...");
  try {
    const debugRes = await axios.get<DebugTokenResponse>(
      `${baseUrl}/debug_token?input_token=${encodeURIComponent(env.metaAccessToken)}&access_token=${encodeURIComponent(appToken)}`,
      { timeout: 10_000 }
    );

    const tokenData = debugRes.data.data;
    tokenType = tokenData?.type ?? "UNKNOWN";
    tokenValid = Boolean(tokenData?.is_valid);

    console.info(`TOKEN TYPE = ${tokenType}`);
    console.info(`TOKEN VALID = ${tokenValid ? "YES" : "NO"}`);

    if (tokenData?.expires_at) {
      const expDate = new Date(tokenData.expires_at * 1000).toISOString();
      console.info(`TOKEN EXPIRES AT = ${expDate}`);
    } else {
      console.info("TOKEN EXPIRES AT = Never (Permanent / Long-lived)");
    }

    const scopes = tokenData?.scopes ?? [];
    const hasMgmt = scopes.includes("whatsapp_business_management");
    const hasMsg = scopes.includes("whatsapp_business_messaging");
    permissionsPass = hasMgmt && hasMsg;
    console.info(`PERMISSIONS = ${permissionsPass ? "PASS" : "FAIL"}`);
    console.info(`  whatsapp_business_management: ${hasMgmt ? "GRANTED" : "MISSING"}`);
    console.info(`  whatsapp_business_messaging: ${hasMsg ? "GRANTED" : "MISSING"}`);

    if (!tokenValid && tokenData?.error) {
      console.info(`  Token Error Code: ${tokenData.error.code ?? "NONE"}`);
      console.info(`  Token Error Subcode: ${tokenData.error.subcode ?? "NONE"}`);
      console.info(`  Token Error Message: ${redactSecrets(tokenData.error.message ?? "")}`);
    }
  } catch (error) {
    const err = parseMetaError(error);
    console.info(`TOKEN INSPECTION = FAIL (HTTP ${err.status})`);
    console.info(`  Meta Error Code: ${err.code}`);
    console.info(`  Meta Error Message: ${err.message}`);
  }

  // 3. Test Meta Authentication via /me
  console.info("\n[3/5] Testing Meta Authentication via token...");
  try {
    const meRes = await axios.get(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${env.metaAccessToken}` },
      timeout: 10_000
    });
    authPass = true;
    console.info(`META AUTHENTICATION = PASS (HTTP ${meRes.status})`);
  } catch (error) {
    const err = parseMetaError(error);
    console.info(`META AUTHENTICATION = FAIL (HTTP ${err.status})`);
    console.info(`  Meta Error Code: ${err.code}`);
    console.info(`  Meta Error Subcode: ${err.subcode}`);
    console.info(`  Meta Error Type: ${err.type}`);
    console.info(`  Meta Error Message: ${err.message}`);
  }

  // 4. Test WABA Access
  console.info("\n[4/5] Testing WhatsApp Business Account (WABA) access...");
  try {
    const wabaRes = await axios.get<WabaResponse>(
      `${baseUrl}/${env.whatsappWabaId}?fields=id,name,phone_numbers{id,display_phone_number}`,
      {
        headers: { Authorization: `Bearer ${env.metaAccessToken}` },
        timeout: 10_000
      }
    );
    wabaPass = true;
    console.info(`WABA ACCESS = PASS (Name: ${wabaRes.data.name ?? "WABA"})`);

    const numbers = wabaRes.data.phone_numbers?.data ?? [];
    phoneMatch = numbers.some((n) => n.id === env.whatsappPhoneNumberId);
  } catch (error) {
    const err = parseMetaError(error);
    console.info(`WABA ACCESS = FAIL (HTTP ${err.status})`);
    console.info(`  Meta Error Code: ${err.code}`);
    console.info(`  Meta Error Subcode: ${err.subcode}`);
    console.info(`  Meta Error Type: ${err.type}`);
    console.info(`  Meta Error Message: ${err.message}`);
  }

  // 5. Test Phone Number Access
  console.info("\n[5/5] Testing WhatsApp Phone Number access...");
  try {
    const phoneRes = await axios.get<PhoneNumberResponse>(
      `${baseUrl}/${env.whatsappPhoneNumberId}?fields=id,verified_name,display_phone_number`,
      {
        headers: { Authorization: `Bearer ${env.metaAccessToken}` },
        timeout: 10_000
      }
    );
    phonePass = true;
    console.info(`PHONE NUMBER ID = PASS (Verified Name: ${phoneRes.data.verified_name ?? "Test"})`);
    if (!phoneMatch && phoneRes.data.id === env.whatsappPhoneNumberId) {
      phoneMatch = true;
    }
  } catch (error) {
    const err = parseMetaError(error);
    console.info(`PHONE NUMBER ID = FAIL (HTTP ${err.status})`);
    console.info(`  Meta Error Code: ${err.code}`);
    console.info(`  Meta Error Subcode: ${err.subcode}`);
    console.info(`  Meta Error Type: ${err.type}`);
    console.info(`  Meta Error Message: ${err.message}`);
  }

  // 6. Test WABA Subscription (only after auth passes)
  let wabaSubscribed = false;
  if (authPass && wabaPass) {
    console.info("\n[6/6] Testing WABA Webhook Subscription...");
    try {
      const subRes = await axios.get<{ data?: Array<{ id?: string; whatsapp_business_api_data?: { id?: string } }> }>(
        `${baseUrl}/${env.whatsappWabaId}/subscribed_apps`,
        {
          headers: { Authorization: `Bearer ${env.metaAccessToken}` },
          timeout: 10_000
        }
      );
      const appIds = (subRes.data.data ?? []).flatMap((item) => {
        const id = item.whatsapp_business_api_data?.id ?? item.id;
        return typeof id === "string" ? [id] : [];
      });
      wabaSubscribed = appIds.includes(env.metaAppId);
      console.info(`WABA SUBSCRIPTION = ${wabaSubscribed ? "VERIFIED" : "NOT VERIFIED"}`);
    } catch (error) {
      const err = parseMetaError(error);
      console.info(`WABA SUBSCRIPTION = FAIL (HTTP ${err.status})`);
      console.info(`  Meta Error Code: ${err.code}`);
      console.info(`  Meta Error Message: ${err.message}`);
    }
  }

  console.info("\n==================================================");
  console.info("SUMMARY REPORT");
  console.info("==================================================");
  console.info(`META APP: ${appPass ? "PASS" : "BLOCKED"}`);
  console.info(`ACCESS TOKEN: ${authPass && tokenValid ? "PASS" : "FAIL / EXPIRED"}`);
  console.info(`TOKEN TYPE: ${tokenType} (${tokenType === "SYSTEM_USER" ? "SUITABLE" : "NOT SUITABLE"})`);
  console.info(`PERMISSIONS: ${permissionsPass ? "PASS" : "FAIL"}`);
  console.info(`WABA: ${wabaPass ? "PASS" : "BLOCKED"}`);
  console.info(`PHONE NUMBER ID: ${phonePass ? "PASS" : "BLOCKED"}`);
  console.info(`PHONE NUMBER MATCH: ${phoneMatch ? "PASS" : "BLOCKED"}`);
  console.info(`WABA SUBSCRIPTION: ${wabaSubscribed ? "VERIFIED" : "NOT VERIFIED"}`);

  if (authPass && appPass && wabaPass && phonePass) {
    console.info("\nOVERALL STATUS: READY");
    process.exitCode = 0;
  } else {
    console.info("\nOVERALL STATUS: BLOCKED (Authentication fix required)");
    process.exitCode = 1;
  }
}

void main();
