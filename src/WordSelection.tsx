import { useState } from "react";
import { api } from "./api";

export default function WordSelection({
  attach,
  answer,
  disabled,
}: {
  attach: (name: string, text: string) => void;
  answer: string;
  disabled: boolean;
}) {
  const [selection, setSelection] = useState<{
    handle: string;
    name: string;
    text: string;
  }>();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  async function action(fn: () => Promise<void>) {
    setWorking(true);
    setNotice("");
    try {
      await fn();
    } catch (error) {
      setNotice(String(error));
    } finally {
      setWorking(false);
    }
  }
  return (
    <details className="word-selection">
      <summary>Word 선택 영역</summary>
      <fieldset disabled={working || disabled}>
        <legend>Windows Word 연결</legend>
        <p>
          Word에서 본문을 선택하고 Windows PowerShell로 도우미를 실행하세요.
          VMware에서는 도우미를 양쪽에서 열 수 있는 개인 공유 폴더에 저장하세요.
        </p>
        <button
          onClick={() =>
            void action(async () => {
              if (await api.wordHelper!())
                setNotice("도우미를 저장했습니다. Windows에서 실행하세요.");
            })
          }
        >
          Windows 도우미 저장
        </button>
        <button
          onClick={() =>
            void action(async () => {
              const captured = await api.wordCapture!();
              if (!captured) return;
              attach(captured.name, captured.text);
              setSelection(captured);
              setText("");
              setNotice("선택한 텍스트를 메시지에 첨부했습니다.");
            })
          }
        >
          Word 선택 영역 가져오기
        </button>
        {selection && (
          <>
            <details>
              <summary>{selection.name} · 원문 확인</summary>
              <pre>{selection.text}</pre>
            </details>
            <label>
              Word에 반영할 수정안
              <textarea
                value={text}
                maxLength={50000}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            {answer && (
              <button
                disabled={answer.length > 50000}
                onClick={() => setText(answer)}
              >
                최근 답변 사용
              </button>
            )}
            <button
              disabled={!text.trim()}
              onClick={() =>
                void action(async () => {
                  await api.wordPropose!(selection.handle, text);
                  setSelection(undefined);
                  setText("");
                  setNotice(
                    "수정안을 보냈습니다. Windows에서 확인 후 Word 문서를 저장하세요.",
                  );
                })
              }
            >
              Word에 수정안 보내기
            </button>
          </>
        )}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
