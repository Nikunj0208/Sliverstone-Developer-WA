import { sendReplyButtons, type ReplyButton } from "../meta/messages.js";
import { setConversationState } from "./conversation-state.js";

export const mainWelcomeButtons: ReplyButton[] = [
  { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
  { id: "MAIN_CHAT", title: "Chat" },
  { id: "MAIN_CALL", title: "Call" }
];

export const mainMenuButtons = mainWelcomeButtons;

export type MainMenuDependencies = {
  sendReplyButtons: typeof sendReplyButtons;
};

const defaultDependencies: MainMenuDependencies = {
  sendReplyButtons
};

export async function showMainWelcomeMenu(
  to: string,
  promptText: string = "👇 Please choose an option below:",
  dependencies: MainMenuDependencies = defaultDependencies
): Promise<void> {
  setConversationState(to, "MAIN_MENU");
  try {
    await dependencies.sendReplyButtons(to, promptText, mainWelcomeButtons);
  } catch {
    console.info("[MENU] MAIN MENU ACTION FAILED");
  }
}

export async function sendMainMenu(
  to: string,
  dependencies: MainMenuDependencies = defaultDependencies
): Promise<void> {
  await showMainWelcomeMenu(to, "👇 Please choose an option below:", dependencies);
}
