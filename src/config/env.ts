import dotenv from "dotenv";

dotenv.config();

export const requiredEnvironmentVariables = [
  "PORT",
  "META_GRAPH_API_VERSION",
  "META_ACCESS_TOKEN",
  "META_APP_SECRET",
  "META_APP_ID",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WABA_ID",
  "WEBHOOK_VERIFY_TOKEN",
  "DEMO_RECIPIENT_NUMBER",
  "CLIENT_PHONE_NUMBER",
  "CLIENT_NAME"
] as const;

export type RequiredEnvironmentVariable =
  (typeof requiredEnvironmentVariables)[number];

export type EnvironmentVariableStatus = {
  name: RequiredEnvironmentVariable;
  status: "configured" | "missing";
};

function value(name: RequiredEnvironmentVariable): string {
  return process.env[name]?.trim() ?? "";
}

function optionalValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Environment validation failed: PORT must be a valid TCP port.");
  }

  return port;
}

export const env = {
  port: value("PORT"),
  metaGraphApiVersion: value("META_GRAPH_API_VERSION"),
  metaAccessToken: value("META_ACCESS_TOKEN"),
  metaAppSecret: value("META_APP_SECRET"),
  metaAppId: value("META_APP_ID"),
  whatsappPhoneNumberId: value("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappWabaId: value("WHATSAPP_WABA_ID"),
  webhookVerifyToken: value("WEBHOOK_VERIFY_TOKEN"),
  demoRecipientNumber: value("DEMO_RECIPIENT_NUMBER"),
  clientPhoneNumber: value("CLIENT_PHONE_NUMBER"),
  clientName: value("CLIENT_NAME"),
  welcomeTemplateName: optionalValue("WELCOME_TEMPLATE_NAME"),
  projectTemplateName: optionalValue("PROJECT_TEMPLATE_NAME"),
  callTemplateName: optionalValue("CALL_TEMPLATE_NAME")
} as const;

export function getEnvironmentValidation(): EnvironmentVariableStatus[] {
  return requiredEnvironmentVariables.map((name) => ({
    name,
    status: value(name) ? "configured" : "missing"
  }));
}

export function assertEnvironment(): void {
  const missing = getEnvironmentValidation()
    .filter((item) => item.status === "missing")
    .map((item) => item.name);

  if (missing.length > 0) {
    throw new Error(
      `Environment validation failed: required variables are missing: ${missing.join(", ")}`
    );
  }

  parsePort(env.port);
}
