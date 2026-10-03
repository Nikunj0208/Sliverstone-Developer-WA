import { type ReplyButton, type ListRow } from "../meta/messages.js";
import {
  setConversationState,
  getConversationState,
  clearConversationState,
  type ConversationState
} from "../flows/conversation-state.js";
import { showMainWelcomeMenu } from "../flows/main-menu.js";
import { sendWelcomeFlow } from "../flows/welcome.js";
import { sendProjectList } from "../flows/projects.js";
import { routeButtonAction, type ActionDependencies } from "../flows/actions.js";
import {
  handleProjectSelection,
  handleProjectBrochure,
  handleProjectPlans,
  handleSquareFeetSelection,
  handleBhkSelection,
  type ProjectFlowDependencies
} from "../flows/project-flow.js";

export type SimulatedMessage =
  | { type: "text"; text: string }
  | { type: "image"; imagePath: string; caption?: string }
  | { type: "document"; documentPath: string; filename: string }
  | { type: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { type: "video"; videoUrlOrId: string; caption?: string }
  | { type: "buttons"; bodyText: string; buttons: ReplyButton[] }
  | { type: "list"; headerText: string; bodyText: string; buttonText: string; sectionTitle: string; rows: ListRow[] };

export class WhatsAppConversationSimulator {
  private messageHistory = new Map<string, SimulatedMessage[]>();

  constructor(private readonly options: { allowRealApi?: boolean } = {}) {}

  public getSentMessages(waId: string): SimulatedMessage[] {
    return this.messageHistory.get(waId) || [];
  }

  public clearSentMessages(waId?: string): void {
    if (waId) {
      this.messageHistory.delete(waId);
    } else {
      this.messageHistory.clear();
    }
  }

  public getState(waId: string): ConversationState | undefined {
    return getConversationState(waId);
  }

  public reset(waId?: string): void {
    this.clearSentMessages(waId);
    if (waId) {
      clearConversationState(waId);
    }
  }

  private recordMessage(waId: string, message: SimulatedMessage): void {
    const list = this.messageHistory.get(waId) || [];
    list.push(message);
    this.messageHistory.set(waId, list);
  }

  public getDependencies(waId: string): ProjectFlowDependencies {
    return {
      sendImage: async (_to, imagePath, caption) => {
        this.recordMessage(waId, { type: "image", imagePath, caption });
        return { httpStatus: 200 };
      },
      sendText: async (_to, text) => {
        this.recordMessage(waId, { type: "text", text });
        return { httpStatus: 200 };
      },
      sendLocation: async (_to, latitude, longitude, name, address) => {
        this.recordMessage(waId, { type: "location", latitude, longitude, name, address });
        return { httpStatus: 200 };
      },
      sendVideo: async (_to, videoUrlOrId, caption) => {
        this.recordMessage(waId, { type: "video", videoUrlOrId, caption });
        return { httpStatus: 200 };
      },
      sendDocument: async (_to, documentPath, filename) => {
        this.recordMessage(waId, { type: "document", documentPath, filename });
        return { httpStatus: 200 };
      },
      sendReplyButtons: async (_to, bodyText, buttons) => {
        this.recordMessage(waId, { type: "buttons", bodyText, buttons });
        return { httpStatus: 200 };
      },
      sendList: async (_to, headerText, bodyText, buttonText, sectionTitle, rows) => {
        this.recordMessage(waId, { type: "list", headerText, bodyText, buttonText, sectionTitle, rows });
        return { httpStatus: 200 };
      },
      showMainWelcomeMenu: async (_to, promptText) => {
        setConversationState(waId, "MAIN_MENU");
        this.recordMessage(waId, {
          type: "buttons",
          bodyText: promptText || "👇 Please choose an option below:",
          buttons: [
            { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
            { id: "MAIN_CHAT", title: "Chat" },
            { id: "MAIN_CALL", title: "Call" }
          ]
        });
      },
      handleChat: async () => {
        setConversationState(waId, "CHAT");
        this.recordMessage(waId, {
          type: "text",
          text: "💬 You are now connected with our sales team. Please type your query, and we will assist you shortly."
        });
      },
      handleCall: async () => {
        setConversationState(waId, "CALL");
        this.recordMessage(waId, {
          type: "text",
          text: "📞 Our sales team is available at: +91 99099 00000"
        });
      },
      sendProjectList: async () => {
        setConversationState(waId, "PROJECT_LIST");
        await sendProjectList(waId);
      }
    };
  }

  public async simulateInboundText(waId: string, text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (/^PROJECT:([a-z0-9-]+)$/i.test(trimmed)) {
      const match = /^PROJECT:([a-z0-9-]+)$/i.exec(trimmed);
      const projectId = match![1].toLowerCase();
      return this.simulateProjectSelection(waId, projectId);
    }

    // Normal welcome flow
    setConversationState(waId, "MAIN_MENU");
    await this.getDependencies(waId).showMainWelcomeMenu(waId, "Welcome to Silverstone! Choose an option below:");
    return true;
  }

  public async simulateButtonClick(waId: string, buttonId: string): Promise<boolean> {
    const deps = this.getDependencies(waId);

    const actionDeps: ActionDependencies = {
      handleChat: async () => deps.handleChat(waId),
      handleCall: async () => deps.handleCall(waId),
      handleSiteVisit: async () => true,
      handleLocationHighlights: async () => {},
      sendProjectList: async () => {
        const projects = (await import("../content/project-service.js")).getActiveProjects();
        const rows = (await import("../layouts/project-list.js")).buildProjectList(projects);
        await deps.sendList(
          waId,
          "Our Projects",
          "Choose a project to explore.",
          "View Projects",
          "Projects",
          rows
        );
      },
      sendProjectBrochure: async (_to, projectId) => deps.sendDocument(waId, `dummy-${projectId}.pdf`, `${projectId}-Brochure.pdf`).then(() => true),
      sendProjectDetails: async (_to, projectId) => this.simulateProjectSelection(waId, projectId),
      sendRajmahalBuildPlanList: async () => true,
      sendRajmahalBuildPlan: async () => true,
      sendSpringHillBuildPlanList: async () => true,
      sendSpringHillBuildPlan: async () => true,
      handleProjectSelection: async (_to, projectId) => this.simulateProjectSelection(waId, projectId),
      handleProjectBrochure: async (_to, projectId) => handleProjectBrochure(waId, projectId, deps),
      handleProjectPlans: async (_to, projectId) => handleProjectPlans(waId, projectId, deps),
      handleSquareFeetSelection: async (_to, projectId, sqftId) => handleSquareFeetSelection(waId, projectId, sqftId, deps),
      handleBhkSelection: async (_to, projectId, sqftId, bhk) => handleBhkSelection(waId, projectId, sqftId, bhk, deps)
    };

    return routeButtonAction(waId, buttonId, actionDeps);
  }

  public async simulateListSelect(waId: string, rowId: string): Promise<boolean> {
    if (rowId.startsWith("PROJECT:")) {
      const projectId = rowId.slice("PROJECT:".length);
      return this.simulateProjectSelection(waId, projectId);
    }
    return this.simulateButtonClick(waId, rowId);
  }

  public async simulateProjectSelection(waId: string, projectId: string): Promise<boolean> {
    const deps = this.getDependencies(waId);
    return handleProjectSelection(waId, projectId, deps);
  }
}

export const simulator = new WhatsAppConversationSimulator();
