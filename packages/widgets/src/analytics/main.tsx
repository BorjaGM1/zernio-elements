import { safeAreaStyle, useWidget } from "../bridge";
import { mount } from "../root";
import { parseAnalytics } from "../types";
import { Analytics, AnalyticsError, AnalyticsSkeleton } from "./Analytics";

function Widget() {
  const w = useWidget("analytics");
  const data = w.result === undefined ? null : parseAnalytics(w.result);
  return (
    <div style={safeAreaStyle(w.host)}>
      {w.resultError ? (
        <AnalyticsError message={w.resultError} />
      ) : data ? (
        <Analytics data={data} />
      ) : w.result !== undefined ? (
        <AnalyticsError message="The tool returned data this widget doesn't understand." />
      ) : w.connectError ? (
        <AnalyticsError message={w.connectError.message} />
      ) : (
        <AnalyticsSkeleton />
      )}
    </div>
  );
}

mount(<Widget />);
