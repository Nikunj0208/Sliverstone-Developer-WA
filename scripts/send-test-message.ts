import { assertEnvironment, env } from "../src/config/env.js";
import { MetaApiRequestError, sendText } from "../src/meta/messages.js";

const testMessage = "✅ Real estate WhatsApp backend connected successfully.";

assertEnvironment();

try {
  const result = await sendText(env.demoRecipientNumber, testMessage);
  console.log("WHATSAPP API REQUEST: SUCCESS");
  console.log(`HTTP status: ${result.httpStatus}`);
  if (result.metaMessageId) {
    console.log(`Meta message ID: ${result.metaMessageId}`);
  }
} catch (error: unknown) {
  console.error("WHATSAPP API REQUEST: FAILED");
  if (error instanceof MetaApiRequestError) {
    console.error(`HTTP status: ${error.httpStatus}`);
    console.error(`Meta error code: ${error.metaErrorCode}`);
    console.error(`Meta error message: ${error.message}`);
  } else {
    console.error("HTTP status: NO_RESPONSE");
    console.error("Meta error code: unavailable");
    console.error("Meta error message: Unknown Meta API error.");
  }
  process.exitCode = 1;
}
