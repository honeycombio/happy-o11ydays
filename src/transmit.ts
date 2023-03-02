import otel, { Context, HrTime, Span, SpanContext } from "@opentelemetry/api";
import {
  HeatmapSpanSpec,
  placeHorizontallyInBucket,
  planEndTime,
} from "./heatmap";
import { TraceSpanSpec } from "./waterfall";

type SpanSpec = TraceSpanSpec &
  HeatmapSpanSpec &
  Record<string, string | number | boolean>;
export type SecondsSinceEpoch = number;

export function sendSpans(
  rootContext: Context,
  spanSpecs: SpanSpec[]
): SpanContext {
  const tracer = otel.trace.getTracer("o11y o11y artistry");
  const begin: SecondsSinceEpoch = Math.ceil(Date.now() / 1000);
  const earliestTimeDelta = Math.min(...spanSpecs.map((s) => s.time_delta));
  // the root span has no height, so it doesn't appear in the heatmap
  return tracer.startActiveSpan(
    "🎼",
    {
      startTime: placeHorizontallyInBucket(begin, earliestTimeDelta, 0),
    },
    rootContext,
    (rootSpan) => {
      // create all the spans for the picture
      var parentContexts: Array<Context> = []; // so that I can make things children of previous spans
      var openSpan: Span = rootSpan; // so that I can add events to it
      var openSpanEndTime: HrTime | undefined = undefined; // so that I can end that openSpan correctly
      spanSpecs.forEach((ss, _spanNumber) => {
        ss["begin"] = begin; // this is handy for sorting the traces by how recently they were created.
        const startTime = placeHorizontallyInBucket(
          begin,
          ss.time_delta,
          ss.increment
        );
        if (ss.spanEvent) {
          // something completely different
          openSpan.addEvent("sparkle", ss, startTime);
        } else {
          closePreviousSpan(rootSpan, openSpan, openSpanEndTime);
          for (var i = 0; i < ss.popBefore; i++) {
            parentContexts.shift(); // this says: don't be a child of the previous span
          }
          tracer.startActiveSpan(
            ss.name,
            {
              startTime,
              attributes: ss,
            },
            parentContexts[0] || otel.context.active(),
            (s) => {
              parentContexts.unshift(otel.context.active());
              for (var i = 0; i < ss.popAfter; i++) {
                parentContexts.shift(); // this says: i'm done with this little picture, back up to the root
              }
              openSpan = s;
              openSpanEndTime = planEndTime(startTime, ss.waterfallWidth);
            }
          );
        }
      });
      openSpan.end(openSpanEndTime);
      rootSpan.end();
      return rootSpan.spanContext();
    }
  );
}

function closePreviousSpan(
  rootSpan: Span,
  openSpan: Span,
  openSpanEndTime: HrTime | undefined
) {
  if (openSpan !== rootSpan) {
    // now that we've added all the spanEvents, close the previous span
    openSpan.end(openSpanEndTime);
  }
}
