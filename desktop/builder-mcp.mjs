import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export async function builderResources({
  endpoint,
  uri,
  key,
  listTools,
  tool,
  args,
}) {
  const url = new URL(endpoint);
  if (
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("MCP 서버의 HTTPS 또는 로컬 HTTP 주소를 확인하세요.");
  const client = new Client({ name: "xdocs-builder", version: "1" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      redirect: "error",
      ...(key ? { headers: { Authorization: "Bearer " + key } } : {}),
    },
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        redirect: "error",
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
  });
  try {
    await client.connect(transport);
    if (listTools || tool) {
      if (!client.getServerCapabilities()?.tools)
        throw Error("이 서버는 도구를 제공하지 않습니다.");
      const tools = [];
      let cursor,
        pages = 0;
      do {
        const page = await client.listTools({ cursor });
        tools.push(
          ...page.tools
            .filter((t) => t.annotations?.readOnlyHint === true)
            .map((t) => ({
              name: t.name,
              description: t.description,
              schema: t.inputSchema,
            })),
        );
        cursor = page.nextCursor;
      } while (cursor && tools.length < 200 && ++pages < 10);
      if (listTools) return { tools: tools.slice(0, 200) };
      if (!tools.some((t) => t.name === tool))
        throw Error("서버가 읽기 전용으로 표시한 도구를 선택하세요.");
      if (
        !args ||
        typeof args !== "object" ||
        Array.isArray(args) ||
        JSON.stringify(args).length > 16000
      )
        throw Error("도구 인자는 16,000자 이하의 JSON 객체여야 합니다.");
      const result = await client.callTool({ name: tool, arguments: args });
      if (result.isError) throw Error("MCP 도구가 오류를 반환했습니다.");
      const text = result.structuredContent
        ? JSON.stringify(result.structuredContent, null, 2)
        : result.content
            ?.filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
      if (!text || text.length > 40000)
        throw Error(
          "도구 결과는 4만 자 이하의 텍스트 또는 구조화된 값이어야 합니다.",
        );
      return { text };
    }
    if (!client.getServerCapabilities()?.resources)
      throw Error("이 MCP 서버는 리소스 조회를 제공하지 않습니다.");
    if (uri === undefined) {
      const resources = [];
      let cursor,
        pages = 0;
      do {
        const page = await client.listResources({ cursor });
        for (const r of page.resources)
          resources.push({ uri: r.uri, name: r.name });
        cursor = page.nextCursor;
      } while (cursor && resources.length < 200 && ++pages < 10);
      return { resources: resources.slice(0, 200) };
    }
    if (typeof uri !== "string" || !uri) throw Error("리소스를 선택하세요.");
    const result = await client.readResource({ uri });
    const texts = result.contents
      .filter((r) => typeof r.text === "string")
      .map((r) => r.text);
    if (!texts.length) throw Error("텍스트 리소스만 사용할 수 있습니다.");
    const text = texts.join("\n");
    if (text.length > 40000) throw Error("MCP 자료가 4만 자를 초과합니다.");
    return { text };
  } finally {
    await client.close();
  }
}
