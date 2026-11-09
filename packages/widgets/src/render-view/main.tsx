import { safeAreaStyle, useWidget } from "../bridge";
import { mount } from "../root";
import { parseRenderView } from "../types";
import { RenderView, RenderViewError, RenderViewSkeleton } from "./RenderView";

function errorsOf(data: unknown): { error?: string; errors: string[] } {
  const d = (data && typeof data === "object" ? data : {}) as { error?: unknown; errors?: unknown };
  return {
    error: typeof d.error === "string" ? d.error : undefined,
    errors: Array.isArray(d.errors) ? d.errors.filter((e): e is string => typeof e === "string") : [],
  };
}

function Widget() {
  const w = useWidget("render-view");
  const data = w.result === undefined ? null : parseRenderView(w.result);
  const body = (() => {
    if (w.resultError) {
      const e = errorsOf(w.resultErrorData);
      return <RenderViewError error={e.error ?? (e.errors.length ? undefined : w.resultError)} errors={e.errors} />;
    }
    if (data) return <RenderView data={data} />;
    if (w.result !== undefined) return <RenderViewError error="The tool returned no view spec." errors={[]} />;
    if (w.connectError) return <RenderViewError error={w.connectError.message} errors={[]} />;
    return <RenderViewSkeleton />;
  })();
  return <div style={safeAreaStyle(w.host)}>{body}</div>;
}

mount(<Widget />);
