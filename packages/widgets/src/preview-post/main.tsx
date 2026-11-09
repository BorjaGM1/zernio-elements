import { safeAreaStyle, useWidget } from "../bridge";
import { mount } from "../root";
import { Message, Shell } from "../shared";
import { isPreviewResult, isPublishResult } from "../types";
import { PreviewError, PreviewPost, PreviewSkeleton } from "./PreviewPost";

function Widget() {
  const w = useWidget("preview-post");
  const r = w.result as (Record<string, unknown> & { mock?: boolean }) | undefined;
  const body = (() => {
    if (w.resultError) return <PreviewError message={w.resultError} />;
    if (isPreviewResult(r)) return <PreviewPost result={r} actions={w.actions} mock={r.mock === true} />;
    if (isPublishResult(r)) {
      // Opened for publish_post directly: show the outcome, nothing to preview.
      return (
        <PreviewPost
          result={{ input: { content: "", platforms: [] }, post: { content: "", media: [] }, targets: [], payload: null, payloadHash: r.payloadHash, publishable: [] }}
          initialPublish={r}
          actions={w.actions}
        />
      );
    }
    if (r !== undefined) return <PreviewError message="The tool returned data this widget doesn't understand." />;
    if (w.cancelled)
      return (
        <Shell>
          <Message title="Preview cancelled">Nothing was prepared or published.</Message>
        </Shell>
      );
    if (w.connectError)
      return (
        <Shell>
          <Message tone="danger" title="Couldn't connect to the host">
            {w.connectError.message}
          </Message>
        </Shell>
      );
    const platforms = Array.isArray(w.input?.platforms) ? (w.input.platforms as string[]) : [];
    return <PreviewSkeleton platforms={platforms} />;
  })();
  return <div style={safeAreaStyle(w.host)}>{body}</div>;
}

mount(<Widget />);
