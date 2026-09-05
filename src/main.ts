import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BlueBubblesClient } from "./bluebubbles.ts";

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}

const client = new BlueBubblesClient();
const server = new McpServer({ name: "bluebubbles-mcp", version: "0.1.0" });

server.registerTool(
  "bluebubbles_status",
  {
    title: "BlueBubbles status",
    description: "Check BlueBubbles server reachability and return server/OS metadata.",
    inputSchema: {},
  },
  async () => {
    try {
      const [pingRes, infoRes] = await Promise.all([
        client.ping(),
        client.getServerInfo(),
      ]);
      return textResult({
        reachable: pingRes.status === 200,
        ping: pingRes.data ?? pingRes.message,
        serverInfo: infoRes.data ?? infoRes.error ?? null,
      });
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_list_chats",
  {
    title: "List BlueBubbles chats",
    description: "List or query active iMessage chats/conversations with pagination and last message preview.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(25).describe("Number of chats to return."),
      offset: z.number().int().min(0).default(0).describe("Number of chats to skip."),
      sort: z.enum(["ASC", "DESC"]).default("DESC").describe("Sort direction by activity."),
      withParticipants: z.boolean().default(true).describe("Include participants for each chat."),
      withLastMessage: z.boolean().default(true).describe("Include last message preview for each chat."),
    },
  },
  async (
    { limit, offset, sort, withParticipants, withLastMessage }: {
      limit: number;
      offset: number;
      sort: "ASC" | "DESC";
      withParticipants: boolean;
      withLastMessage: boolean;
    },
  ) => {
    try {
      const res = await client.listChats({
        limit,
        offset,
        sort,
        withParticipants,
        withLastMessage,
      });
      if (res.error) return errorResult(res.error);
      return textResult(res.data ?? []);
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_get_chat",
  {
    title: "Get BlueBubbles chat details",
    description: "Get detailed chat metadata and participant list for a specific chat GUID.",
    inputSchema: {
      chatGuid: z.string().describe("The unique GUID of the chat (e.g. iMessage;-;+1234567890 or iMessage;+;chat123456)."),
      withParticipants: z.boolean().default(true).describe("Include participant details."),
      withMessages: z.boolean().default(false).describe("Include recent messages in response."),
      limit: z.number().int().min(1).max(100).optional().describe("Max recent messages to include if withMessages is true."),
    },
  },
  async (
    { chatGuid, withParticipants, withMessages, limit }: {
      chatGuid: string;
      withParticipants: boolean;
      withMessages: boolean;
      limit?: number;
    },
  ) => {
    try {
      const res = await client.getChat(chatGuid, {
        withParticipants,
        withMessages,
        limit,
      });
      if (res.error) return errorResult(res.error);
      return textResult(res.data ?? null);
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_list_messages",
  {
    title: "List BlueBubbles messages",
    description: "Fetch or search messages across all chats or within a specific chat GUID.",
    inputSchema: {
      chatGuid: z.string().optional().describe("Optional chat GUID to restrict message listing to a specific conversation."),
      searchQuery: z.string().optional().describe("Search substring in message text across all messages."),
      limit: z.number().int().min(1).max(100).default(25).describe("Number of messages to return."),
      offset: z.number().int().min(0).default(0).describe("Number of messages to skip."),
      sort: z.enum(["ASC", "DESC"]).default("DESC").describe("Sort direction by date."),
      withChat: z.boolean().default(true).describe("Include parent chat details."),
      withHandle: z.boolean().default(true).describe("Include sender handle details."),
      withAttachment: z.boolean().default(true).describe("Include attachment metadata."),
    },
  },
  async (
    { chatGuid, searchQuery, limit, offset, sort, withChat, withHandle, withAttachment }: {
      chatGuid?: string;
      searchQuery?: string;
      limit: number;
      offset: number;
      sort: "ASC" | "DESC";
      withChat: boolean;
      withHandle: boolean;
      withAttachment: boolean;
    },
  ) => {
    try {
      const res = await client.listMessages({
        chatGuid,
        searchQuery,
        limit,
        offset,
        sort,
        withChat,
        withHandle,
        withAttachment,
      });
      if (res.error) return errorResult(res.error);
      return textResult(res.data ?? []);
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_get_contacts",
  {
    title: "Get BlueBubbles contacts",
    description: "Get synced macOS contacts from the BlueBubbles server.",
    inputSchema: {},
  },
  async () => {
    try {
      const res = await client.getContacts();
      if (res.error) return errorResult(res.error);
      return textResult(res.data ?? []);
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_send_message",
  {
    title: "Send BlueBubbles message",
    description: "Send an iMessage text message to an existing chat GUID or address (phone number / email).",
    inputSchema: {
      text: z.string().min(1).describe("The text content of the message to send."),
      chatGuid: z.string().optional().describe("Chat GUID (e.g. iMessage;-;+1234567890 or iMessage;+;chat123456)."),
      address: z.string().optional().describe("Recipient phone number or email address if chatGuid is not provided."),
      method: z.enum(["apple-script", "private-api"]).default("apple-script").describe("Delivery method."),
      subject: z.string().optional().describe("Optional message subject line."),
    },
  },
  async (
    { text, chatGuid, address, method, subject }: {
      text: string;
      chatGuid?: string;
      address?: string;
      method: "apple-script" | "private-api";
      subject?: string;
    },
  ) => {
    try {
      const res = await client.sendMessage({
        text,
        chatGuid,
        address,
        method,
        subject,
      });
      if (res.error) return errorResult(res.error);
      return textResult({
        success: true,
        message: "Message sent",
        data: res.data ?? null,
      });
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "bluebubbles_send_reaction",
  {
    title: "Send BlueBubbles reaction",
    description: "Send a Tapback reaction to a specific iMessage (requires BlueBubbles Private API).",
    inputSchema: {
      selectedMessageGuid: z.string().describe("The GUID of the message to react to."),
      reaction: z.enum([
        "love",
        "like",
        "dislike",
        "laugh",
        "emphasize",
        "question",
        "-love",
        "-like",
        "-dislike",
        "-laugh",
        "-emphasize",
        "-question",
      ]).describe("The reaction type (prefix with minus '-' to remove reaction)."),
      chatGuid: z.string().optional().describe("Optional chat GUID for the conversation."),
    },
  },
  async (
    { selectedMessageGuid, reaction, chatGuid }: {
      selectedMessageGuid: string;
      reaction: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" | "-love" | "-like" | "-dislike" | "-laugh" | "-emphasize" | "-question";
      chatGuid?: string;
    },
  ) => {
    try {
      const res = await client.sendReaction({
        selectedMessageGuid,
        reaction,
        chatGuid,
      });
      if (res.error) return errorResult(res.error);
      return textResult({
        success: true,
        message: `Reaction '${reaction}' sent`,
        data: res.data ?? null,
      });
    } catch (err) {
      return errorResult(err);
    }
  },
);

await server.connect(new StdioServerTransport());
