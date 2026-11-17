import { selectedTableTSV } from "./tableClipboard";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code2,
  GripVertical,
  Heading2,
  Link2,
  ListTodo,
} from "lucide-react";
import type { Note } from "./types";
export default function BlockEditor({
  value,
  onChange,
  notes,
  onComposition,
}: {
  value: string;
  onChange: (value: string) => void;
  notes: Note[];
  onComposition: (value: boolean) => void;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const composition = useRef(onComposition);
  composition.current = onComposition;
  const [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [outline, setOutline] = useState(false);
  const [, render] = useState(0);
  const drag = useRef<number | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Markdown,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": "블록 편집기",
        role: "textbox",
        "aria-multiline": "true",
      },
      handleDOMEvents: {
        compositionstart: () => {
          composition.current(true);
          return false;
        },
        compositionend: () => {
          composition.current(false);
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      change.current(
        editor.getMarkdown().replace(/\\\[\\\[([^\n]+?)\\\]\\\]/g, "[[$1]]"),
      );
      render((n) => n + 1);
    },
  });
  useEffect(() => {
    if (
      editor &&
      !editor.isDestroyed &&
      editor.isInitialized &&
      !editor.isFocused &&
      editor.getMarkdown() !== value
    )
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
  }, [editor, value]);
  if (!editor) return null;
  const blocks = editor.getJSON().content || [];
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    next.splice(to, 0, next.splice(from, 1)[0]);
    editor.commands.setContent({ type: "doc", content: next });
    render((n) => n + 1);
  };
  return (
    <div
      className="block-editor"
      onCopyCapture={(e) => {
        const text = selectedTableTSV(e.currentTarget);
        if (text !== null) {
          e.preventDefault();
          e.stopPropagation();
          e.clipboardData.setData("text/plain", text);
        }
      }}
    >
      <div className="editor-toolbar">
        <button
          aria-label="블록 굵게"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </button>
        <button
          aria-label="블록 소제목"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={17} />
        </button>
        <button
          aria-label="블록 할 일"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo size={17} />
        </button>
        <button
          aria-label="블록 코드"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 size={17} />
        </button>
        <button aria-label="노트 링크 선택" onClick={() => setPicker(!picker)}>
          <Link2 size={17} />
        </button>
        <button onClick={() => setOutline(!outline)}>
          <GripVertical size={16} />
          블록 정렬
        </button>
      </div>
      {picker && (
        <div className="link-picker">
          <input
            aria-label="연결할 노트 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노트를 선택하세요"
          />
          {notes
            .filter((n) => n.title.includes(query))
            .slice(0, 20)
            .map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "text",
                      text: `[[${n.id}|${n.title}]]`,
                    })
                    .run();
                  setPicker(false);
                }}
              >
                {n.title}
              </button>
            ))}
        </div>
      )}
      {outline && (
        <div className="block-outline">
          {blocks.map((block, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => {
                drag.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag.current !== null) move(drag.current, i);
                drag.current = null;
              }}
            >
              <GripVertical size={14} />
              <span>
                {i + 1}. {block.type}
              </span>
              <button
                aria-label={`${i + 1}번 블록 위로`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label={`${i + 1}번 블록 아래로`}
                disabled={i === blocks.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="markdown rich-editor" />
    </div>
  );
}
