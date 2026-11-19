import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import current from "../LICENSE?raw";
import { version } from "../package.json";

export function LicensePage({
  back,
  close,
}: {
  back: () => void;
  close: () => void;
}) {
  const [notices, setNotices] = useState<{ name: string; text: string }[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    window.xdocs
      ?.analyzerNotices?.()
      .then(setNotices)
      .catch(() => setError(true));
  }, []);
  return (
    <div className="overlay" onClick={close}>
      <section
        className="dialog settings-dialog license-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <button className="button" onClick={back}>
            <ArrowLeft size={16} />
            환경 설정
          </button>
          <button
            className="icon-button"
            aria-label="라이선스 정보 닫기"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <h2 id="license-title" tabIndex={-1}>
          라이선스 정보
        </h2>
        <p>xdocs {version} · PolyForm Internal Use License 1.0.0</p>
        <p>
          회사 내부 업무를 위해 사용하고 수정하거나 파생 앱을 만들 수 있습니다.
          외부 배포에는 별도 허가가 필요합니다.
        </p>
        <details>
          <summary>현재 사용권 전문</summary>
          <pre>{current}</pre>
        </details>
        {window.xdocs && (
          <>
            <h3>내장 분석 도구 라이선스</h3>
            {error && (
              <p role="status">설치된 분석 도구의 고지를 읽을 수 없습니다.</p>
            )}
            {notices.map(({ name, text }) => (
              <details key={name}>
                <summary>{name}</summary>
                <pre>{text}</pre>
              </details>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
