import { useState } from "react";
import { api } from "./api";
export default function BuilderContext({
  onText,
  disabled,
}: {
  onText: (s: string) => void;
  disabled: boolean;
}) {
  const [address, setAddress] = useState(""),
    [resources, setResources] = useState<{ uri: string; name: string }[]>([]),
    [uri, setUri] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [key, setKey] = useState(""),
    [toolList, setToolList] = useState<
      { name: string; description?: string; schema: Record<string, unknown> }[]
    >([]),
    [tool, setTool] = useState(""),
    [args, setArgs] = useState("{}");
  function reset() {
    setResources([]);
    setUri("");
    setToolList([]);
    setTool("");
    setArgs("{}");
    onText("");
    setMessage("");
  }
  async function query(read: boolean, tools = false) {
    setBusy(true);
    setMessage("");
    onText("");
    try {
      const result = await api.builderResources!({
        endpoint: address,
        key,
        ...(tools
          ? read
            ? { tool, args: JSON.parse(args) }
            : { listTools: true }
          : read
            ? { uri }
            : {}),
      });
      if (read) {
        onText(result.text || "");
        setMessage("선택 자료를 모델 입력에 추가했습니다.");
      } else if (tools) {
        setToolList(result.tools || []);
        setTool(result.tools?.[0]?.name || "");
        setMessage((result.tools?.length || 0) + "개 읽기 전용 도구");
      } else {
        setResources(result.resources || []);
        setUri(result.resources?.[0]?.uri || "");
        setMessage((result.resources?.length || 0) + "개 리소스");
      }
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>MCP 참고 자료</summary>
      <fieldset disabled={busy || disabled}>
        <label>
          MCP 서버 주소
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              reset();
              setKey("");
            }}
          />
        </label>
        <label>
          MCP 액세스 토큰 (선택)
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              reset();
            }}
          />
        </label>
        <button disabled={!address} onClick={() => void query(false, true)}>
          읽기 전용 도구 조회
        </button>
        {toolList.length > 0 && (
          <>
            <label>
              호출할 도구
              <select
                value={tool}
                onChange={(e) => {
                  setTool(e.target.value);
                  setArgs("{}");
                  onText("");
                }}
              >
                {toolList.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
            <details>
              <summary>도구 설명과 인자 형식</summary>
              <p>{toolList.find((t) => t.name === tool)?.description}</p>
              <pre>
                {JSON.stringify(
                  toolList.find((t) => t.name === tool)?.schema,
                  null,
                  2,
                )}
              </pre>
            </details>
            <label>
              전송할 JSON 인자
              <textarea
                value={args}
                onChange={(e) => {
                  setArgs(e.target.value);
                  onText("");
                }}
              />
            </label>
            <button onClick={() => void query(true, true)}>
              선택 도구 호출
            </button>
          </>
        )}
        <button disabled={!address} onClick={() => void query(false)}>
          리소스 조회
        </button>
        {resources.length > 0 && (
          <>
            <label>
              참고 리소스
              <select
                value={uri}
                onChange={(e) => {
                  setUri(e.target.value);
                  onText("");
                  setMessage("");
                }}
              >
                {resources.map((r) => (
                  <option key={r.uri} value={r.uri}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => void query(true)}>자료 읽기</button>
          </>
        )}
        <p role="status">{message}</p>
      </fieldset>
    </details>
  );
}
