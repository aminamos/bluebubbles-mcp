import { assertEquals } from "jsr:@std/assert@1";
import { BlueBubblesClient } from "../src/bluebubbles.ts";

Deno.test("BlueBubblesClient - ping builds correct URL with password", async () => {
  let requestedUrl = "";
  let requestedMethod = "";

  const mockFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = input.toString();
    requestedMethod = init?.method ?? "GET";
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          message: "Ping received!",
          data: "pong",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const client = new BlueBubblesClient({
    baseUrl: "http://100.121.42.225:1234",
    password: "test_secret_password",
    fetchFn: mockFetch,
  });

  const res = await client.ping();
  assertEquals(res.status, 200);
  assertEquals(res.data, "pong");
  assertEquals(requestedMethod, "GET");
  assertEquals(requestedUrl, "http://100.121.42.225:1234/api/v1/ping?password=test_secret_password");
});

Deno.test("BlueBubblesClient - listChats sends POST query with with-fields", async () => {
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> | null = null;

  const mockFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = input.toString();
    requestedBody = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          message: "Success",
          data: [
            {
              guid: "iMessage;-;+15551234567",
              displayName: "Alice",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const client = new BlueBubblesClient({
    baseUrl: "http://127.0.0.1:1234",
    password: "pwd",
    fetchFn: mockFetch,
  });

  const res = await client.listChats({ limit: 10, offset: 5, sort: "DESC" });
  assertEquals(res.status, 200);
  assertEquals(res.data?.length, 1);
  assertEquals(requestedUrl, "http://127.0.0.1:1234/api/v1/chat/query?password=pwd");
  assertEquals(requestedBody, {
    limit: 10,
    offset: 5,
    sort: "DESC",
    with: ["participants", "lastMessage"],
  });
});

Deno.test("BlueBubblesClient - listMessages with chatGuid uses GET /api/v1/chat/:guid/message", async () => {
  let requestedUrl = "";

  const mockFetch: typeof fetch = (input: RequestInfo | URL) => {
    requestedUrl = input.toString();
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          message: "Success",
          data: [
            {
              guid: "msg-123",
              text: "Hello!",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const client = new BlueBubblesClient({
    baseUrl: "http://127.0.0.1:1234",
    password: "pwd",
    fetchFn: mockFetch,
  });

  const res = await client.listMessages({ chatGuid: "iMessage;-;+15551234567", limit: 20 });
  assertEquals(res.status, 200);
  assertEquals(res.data?.[0].text, "Hello!");
  assertEquals(
    requestedUrl,
    "http://127.0.0.1:1234/api/v1/chat/iMessage%3B-%3B%2B15551234567/message?password=pwd&limit=20&offset=0&sort=DESC&with=handle%2Cattachment",
  );
});

Deno.test("BlueBubblesClient - sendMessage creates tempGuid and sends POST", async () => {
  let requestedUrl = "";
  let payloadRecord: Record<string, unknown> = {};

  const mockFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = input.toString();
    if (init?.body) {
      payloadRecord = JSON.parse(init.body as string) as Record<string, unknown>;
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          message: "Success",
          data: {
            guid: "msg-sent-999",
            text: "Testing outbound",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const client = new BlueBubblesClient({
    baseUrl: "http://127.0.0.1:1234",
    password: "pwd",
    fetchFn: mockFetch,
  });

  const res = await client.sendMessage({
    address: "+15559876543",
    text: "Testing outbound",
  });

  assertEquals(res.status, 200);
  assertEquals(res.data?.guid, "msg-sent-999");
  assertEquals(requestedUrl, "http://127.0.0.1:1234/api/v1/message/text?password=pwd");
  assertEquals(payloadRecord["chatGuid"], "any;+;+15559876543");
  assertEquals(payloadRecord["message"], "Testing outbound");
  assertEquals(payloadRecord["method"], "apple-script");
  assertEquals(typeof payloadRecord["tempGuid"], "string");
});

Deno.test("BlueBubblesClient - sendReaction sends reaction payload", async () => {
  let requestedUrl = "";
  let payloadRecord: Record<string, unknown> = {};

  const mockFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = input.toString();
    if (init?.body) {
      payloadRecord = JSON.parse(init.body as string) as Record<string, unknown>;
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          message: "Success",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const client = new BlueBubblesClient({
    baseUrl: "http://127.0.0.1:1234",
    password: "pwd",
    fetchFn: mockFetch,
  });

  const res = await client.sendReaction({
    selectedMessageGuid: "target-msg-guid",
    reaction: "love",
    chatGuid: "iMessage;-;+15551234567",
  });

  assertEquals(res.status, 200);
  assertEquals(requestedUrl, "http://127.0.0.1:1234/api/v1/message/react?password=pwd");
  assertEquals(payloadRecord["selectedMessageGuid"], "target-msg-guid");
  assertEquals(payloadRecord["reaction"], "love");
  assertEquals(payloadRecord["chatGuid"], "iMessage;-;+15551234567");
});
