import { createApp } from "../src/app.js";
import { initDatabase } from "../src/db/index.js";
import type { Server } from "http";

async function run() {
  const repo = await initDatabase();
  const app = createApp();
  
  const server: Server = app.listen(3002);
  console.log("Test server running on port 3002");

  try {
    // 1. Test /api/crm/contacts
    const contactsRes = await fetch("http://localhost:3002/api/crm/contacts?limit=5");
    const contactsData = await contactsRes.json();
    console.log("Contacts endpoint success:", contactsData.success, "Total:", contactsData.total, "Returned:", contactsData.contacts?.length);
    if (contactsData.contacts?.length > 0) {
      console.log("Sample contact item:", {
        wa_id: contactsData.contacts[0].wa_id,
        name: contactsData.contacts[0].name,
        profile_name: contactsData.contacts[0].profile_name,
        window_24h_open: contactsData.contacts[0].window_24h_open,
        latest_message_preview: contactsData.contacts[0].latest_message_preview,
        latest_status: contactsData.contacts[0].latest_status
      });
    }

    // 2. Test /api/crm/chats/:wa_id
    const targetWaId = contactsData.contacts[0].wa_id;
    const chatRes = await fetch(`http://localhost:3002/api/crm/chats/${targetWaId}`);
    const chatData = await chatRes.json();
    console.log(`Chats endpoint for ${targetWaId}: success=${chatData.success}`);
    console.log("Window 24h status:", chatData.window24h);
    console.log("Messages count:", chatData.messages?.length);
    console.log("Approved templates count:", chatData.approvedTemplates?.length);
    if (chatData.messages?.length > 0) {
      console.log("Sample message:", {
        wamid: chatData.messages[0].wamid,
        direction: chatData.messages[0].direction,
        status: chatData.messages[0].status,
        content_body: chatData.messages[0].content_body?.slice(0, 50)
      });
    }

  } finally {
    server.close();
    process.exit(0);
  }
}

run().catch(e => {
  console.error("Endpoint test failed:", e);
  process.exit(1);
});

