import { sdk } from "./initialize-tracing";

import otel, { Context, Span, SpanContext } from "@opentelemetry/api";
import { checkAuthorization, findLinkToDataset } from "./honeyApi";
import {
  placeHorizontallyInBucket,
  SecondsSinceEpoch,
  HeatmapSpanSpec,
  planEndTime,
  HrTime,
  convertPixelsToSpans,
} from "./heatmap";
import { addStackedGraphAttributes } from "./stackedGraph";
import { initializeDataset } from "./dataset";
import { buildPicturesInWaterfall, TraceSpanSpec } from "./waterfall";
import { spaninate, spaninateAsync } from "./tracing";
import { InternalConfig, readConfiguration } from "./config";

const greeting = ` _________________ 
< Happy O11ydays! >
 ----------------- 
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;

async function main(rootContext: Context, imageFile: string) {
  const config = readConfiguration(imageFile);

  const authData = await spaninateAsync(
    "check authorization",
    checkAuthorization
  );
  await spaninateAsync("init dataset", initializeDataset);

  spaninate("greet", () => console.log(greeting));

  const spanSpecs = spaninate("plan spans", () => planSpans(config));

  const sentSpanContext = spaninate("send spans", () =>
    sendSpans(rootContext, spanSpecs)
  );
  tracer
    .startSpan("link to trace", { links: [{ context: sentSpanContext }] })
    .end();

  const url = await spaninateAsync("find link to dataset", () =>
    findLinkToDataset(authData, sentSpanContext.traceId)
  );
  console.log("  Oh look, I drew a picture: " + url + "\n");
}

type SpanSpec = HeatmapSpanSpec &
  TraceSpanSpec &
  Record<string, number | string | boolean>;

function planSpans(config: InternalConfig): SpanSpec[] {
  const heatmapSpanSpecs = spaninate("convert pixels to spans", () =>
    convertPixelsToSpans(config.heatmap)
  );

  const graphSpanSpecs = spaninate("add stacked graph attributes", () => {
    return addStackedGraphAttributes(config.stackedGraph, heatmapSpanSpecs);
  });
  const spanSpecs = spaninate("build pictures in waterfall", () =>
    buildPicturesInWaterfall(config.waterfall, graphSpanSpecs)
  );

  return spanSpecs;
}

function sendSpans(rootContext: Context, spanSpecs: SpanSpec[]): SpanContext {
  const tracer = otel.trace.getTracer("o11y o11y artistry");
  const begin: SecondsSinceEpoch = Math.ceil(Date.now() / 1000);
  var traceId: string;
  const earliestTimeDelta = Math.min(...spanSpecs.map((s) => s.time_delta));
  // the root span has no height, so it doesn't appear in the heatmap
  return tracer.startActiveSpan(
    "🎼",
    {
      startTime: placeHorizontallyInBucket(begin, earliestTimeDelta, 0),
      links: [
        {
          attributes: { why: "run that created me" },
          context: otel.trace.getActiveSpan()!.spanContext(),
        },
      ],
    },
    rootContext,
    (rootSpan) => {
      // create all the spans for the picture
      var parentContexts: Array<Context> = []; // so that I can make things children of previous spans
      var openSpan: Span = rootSpan; // so that I can add events to it
      var openSpanEndTime: HrTime | undefined = undefined; // so that I can end that openSpan correctly
      spanSpecs.forEach((ss, _spanNumber) => {
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

const byTime = function (ss1: HeatmapSpanSpec, ss2: HeatmapSpanSpec) {
  return ss2.time_delta - ss1.time_delta;
};

const tracer = otel.trace.getTracer("main.ts");

const imageFile = process.argv[2] || "input/happyO11ydays.json";
const rootContext = otel.context.active();
sdk
  .start()
  .then(() =>
    tracer.startActiveSpan("main", (s) =>
      main(rootContext, imageFile)
        .then(
          () => {
            s.end();
          },
          (e) => {
            s.recordException(e);
            s.end();
            console.log(e); // do catch it, so that the sdk will shutdown and we will get the whole trace
          }
        )
        .then(() => printTraceLink(s))
    )
  )
  .then(() => sdk.shutdown());

function printTraceLink(s: Span) {
  console.log(
    `Trace in jaeger: http://localhost:16686/trace/${s.spanContext().traceId}`
  );
  console.log(
    `Trace in honeycomb:https://ui.honeycomb.io/modernity/environments/spotcon/datasets/happy-o11ydays/trace?trace_id=${
      s.spanContext().traceId
    }`
  );
}
