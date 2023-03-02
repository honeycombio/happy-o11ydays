import { sdk } from "./initialize-tracing";

import otel, { Context, Span, SpanContext } from "@opentelemetry/api";
import { checkAuthorization, findLinkToDataset } from "./honeyApi";
import { HeatmapSpanSpec, convertPixelsToSpans } from "./heatmap";
import { addStackedGraphAttributes } from "./stackedGraph";
import { initializeDataset } from "./dataset";
import { buildPicturesInWaterfall, TraceSpanSpec } from "./waterfall";
import { spaninate, spaninateAsync } from "./tracing";
import { InternalConfig, readConfiguration } from "./config";
import { sendSpans } from "./transmit";

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
    sendSpans({}, rootContext, spanSpecs)
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
