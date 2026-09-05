export interface BlueBubblesConfig {
  baseUrl?: string;
  password?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface ApiResponse<T = unknown> {
  status: number;
  message: string;
  data?: T;
  error?: { error: string };
}

export interface ServerInfo {
  os_version?: string;
  server_version?: string;
  private_api?: boolean;
  helper_connected?: boolean;
  detected_imessage?: boolean;
  [key: string]: unknown;
}

export interface Handle {
  originalROWID?: number;
  address: string;
  country?: string;
  uncanonicalizedId?: string;
  [key: string]: unknown;
}

export interface Chat {
  guid: string;
  chatIdentifier?: string;
  displayName?: string;
  isArchived?: boolean;
  participants?: Handle[];
  lastMessage?: Message;
  [key: string]: unknown;
}

export interface Message {
  guid?: string;
  text?: string;
  handle?: Handle;
  isFromMe?: boolean;
  date?: string;
  [key: string]: unknown;
}

export interface Contact {
  id?: string;
  displayName?: string;
  handles?: Handle[];
  [key: string]: unknown;
}

// Cross-platform environment variable accessor
function getEnv(key: string, defaultValue?: string): string {
  if (typeof Deno !== "undefined" && Deno.env?.get) {
    const val = Deno.env.get(key);
    if (val !== undefined) return val;
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return defaultValue ?? "";
}

export class BlueBubblesClient {
  private readonly baseUrl: string;
  private readonly password?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: BlueBubblesConfig = {}) {
    let url = config.baseUrl || getEnv("BLUEBUBBLES_URL", "http://127.0.0.1:12345");
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    this.baseUrl = url;
    this.password = config.password ?? getEnv("BLUEBUBBLES_PASSWORD");
    const parsedTimeout = Number(config.timeoutMs ?? getEnv("BLUEBUBBLES_TIMEOUT_MS", "15000"));
    this.timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  private buildUrl(path: string, queryParams: Record<string, string | number | boolean | undefined> = {}): URL {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
    if (this.password) {
      url.searchParams.set("password", this.password);
    }
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
    return url;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    queryParams: Record<string, string | number | boolean | undefined> = {},
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, queryParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const res = await this.fetchFn(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
      if (!res.ok && !json.error) {
        return {
          status: res.status,
          message: res.statusText || "HTTP error",
          error: {
            error: `HTTP ${res.status}: ${res.statusText}`,
          },
        };
      }
      return json;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 500,
        message: "Request failed",
        error: {
          error: message,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<ApiResponse<string>> {
    return await this.request<string>("GET", "/api/v1/ping");
  }

  async getServerInfo(): Promise<ApiResponse<ServerInfo>> {
    return await this.request<ServerInfo>("GET", "/api/v1/server/info");
  }

  async listChats(options: {
    limit?: number;
    offset?: number;
    sort?: "ASC" | "DESC";
    withParticipants?: boolean;
    withLastMessage?: boolean;
  } = {}): Promise<ApiResponse<Chat[]>> {
    const withList: string[] = [];
    if (options.withParticipants !== false) withList.push("participants");
    if (options.withLastMessage !== false) withList.push("lastMessage");

    const payload: Record<string, unknown> = {
      limit: options.limit ?? 25,
      offset: options.offset ?? 0,
      sort: options.sort ?? "DESC",
    };
    if (withList.length > 0) {
      payload.with = withList;
    }

    return await this.request<Chat[]>("POST", "/api/v1/chat/query", {}, payload);
  }

  async getChat(chatGuid: string, options: {
    withParticipants?: boolean;
    withMessages?: boolean;
    limit?: number;
  } = {}): Promise<ApiResponse<Chat>> {
    const query: Record<string, string | number | undefined> = {};
    const withList: string[] = [];
    if (options.withParticipants !== false) withList.push("participants");
    if (options.withMessages) withList.push("messages");
    if (withList.length > 0) {
      query.with = withList.join(",");
    }
    if (options.limit) {
      query.limit = options.limit;
    }
    return await this.request<Chat>("GET", `/api/v1/chat/${encodeURIComponent(chatGuid)}`, query);
  }

  async listMessages(options: {
    chatGuid?: string;
    limit?: number;
    offset?: number;
    sort?: "ASC" | "DESC";
    withChat?: boolean;
    withHandle?: boolean;
    withAttachment?: boolean;
    searchQuery?: string;
  } = {}): Promise<ApiResponse<Message[]>> {
    if (options.chatGuid) {
      const queryParams: Record<string, string | number | undefined> = {
        limit: options.limit ?? 25,
        offset: options.offset ?? 0,
        sort: options.sort ?? "DESC",
      };
      const withList: string[] = [];
      if (options.withHandle !== false) withList.push("handle");
      if (options.withAttachment !== false) withList.push("attachment");
      if (withList.length > 0) {
        queryParams.with = withList.join(",");
      }
      return await this.request<Message[]>(
        "GET",
        `/api/v1/chat/${encodeURIComponent(options.chatGuid)}/message`,
        queryParams,
      );
    }

    const withList: string[] = [];
    if (options.withChat !== false) withList.push("chat");
    if (options.withHandle !== false) withList.push("handle");
    if (options.withAttachment !== false) withList.push("attachment");

    const payload: Record<string, unknown> = {
      limit: options.limit ?? 25,
      offset: options.offset ?? 0,
      sort: options.sort ?? "DESC",
    };
    if (withList.length > 0) {
      payload.with = withList;
    }
    if (options.searchQuery) {
      payload.where = [
        {
          statement: "message.text LIKE :search",
          args: { search: `%${options.searchQuery}%` },
        },
      ];
    }

    return await this.request<Message[]>("POST", "/api/v1/message/query", {}, payload);
  }

  async getContacts(): Promise<ApiResponse<Contact[]>> {
    return await this.request<Contact[]>("GET", "/api/v1/contact");
  }

  async sendMessage(params: {
    chatGuid?: string;
    address?: string;
    text: string;
    method?: "apple-script" | "private-api";
    effectId?: string;
    subject?: string;
  }): Promise<ApiResponse<Message>> {
    if (!params.chatGuid && !params.address) {
      throw new Error("Either chatGuid or address must be provided");
    }
    if (!params.text || params.text.trim().length === 0) {
      throw new Error("Message text cannot be empty");
    }

    let chatGuid = params.chatGuid;
    if (!chatGuid && params.address) {
      chatGuid = `any;+;${params.address}`;
    }

    const payload: Record<string, unknown> = {
      chatGuid,
      tempGuid: `temp-${crypto.randomUUID()}`,
      message: params.text,
      method: params.method ?? "apple-script",
    };
    if (params.effectId) payload.effectId = params.effectId;
    if (params.subject) payload.subject = params.subject;

    return await this.request<Message>("POST", "/api/v1/message/text", {}, payload);
  }

  async sendReaction(params: {
    selectedMessageGuid: string;
    reaction: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" | "-love" | "-like" | "-dislike" | "-laugh" | "-emphasize" | "-question";
    chatGuid?: string;
  }): Promise<ApiResponse<unknown>> {
    if (!params.selectedMessageGuid) {
      throw new Error("selectedMessageGuid is required");
    }
    const payload: Record<string, unknown> = {
      selectedMessageGuid: params.selectedMessageGuid,
      reaction: params.reaction,
    };
    if (params.chatGuid) {
      payload.chatGuid = params.chatGuid;
    }
    return await this.request("POST", "/api/v1/message/react", {}, payload);
  }
}
