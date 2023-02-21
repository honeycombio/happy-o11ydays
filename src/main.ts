import { sdk } from "./tracing";
import { Pixels, readImage } from "./image";

import otel, { Context, Span } from "@opentelemetry/api";
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
  await checkAuthorization();
  await initializeDataset();

  console.log(greeting);

  const pixels = readImage(imageFile);
  console.log(`Read ${pixels.width}x${pixels.height} image from ${imageFile}`);

  const spanSpecs = planSpans(pixels);
  console.log(`Sending ${spanSpecs.length} spans...`);

  const traceId = sendSpans(rootContext, spanSpecs);
  console.log("We did it! The trace ID is: " + traceId);

  const link = await findLinkToDataset(traceId);
  console.log("Run a new query for HEATMAP(height) in this dataset: " + link);

  console.log(
    "Check the README for how to get the query just right, and see the picture, and then investigate it!"
  );
}

type SpanSpec = HeatmapSpanSpec &
  TraceSpanSpec &
  Record<string, number | string | boolean>;

function planSpans(pixels: Pixels): SpanSpec[] {
  const heatmapSpanSpecs = convertPixelsToSpans(pixels);

  const graphSpanSpecs = addStackedGraphAttributes(heatmapSpanSpecs);
  const spanSpecs = buildPicturesInWaterfall(graphSpanSpecs);

  return spanSpecs;
}

type TraceID = string;
const tracer = otel.trace.getTracer("viz-art");
function sendSpans(rootContext: Context, spanSpecs: SpanSpec[]): TraceID {
  const begin: SecondsSinceEpoch = Math.ceil(Date.now() / 1000);
  var traceId: string;
  const earliestTimeDelta = Math.min(...spanSpecs.map((s) => s.time_delta));
  // the root span has no height, so it doesn't appear in the heatmap
  return tracer.startActiveSpan(
    "🎼",
    { startTime: placeHorizontallyInBucket(begin, earliestTimeDelta, 0) },
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
      traceId = rootSpan.spanContext().traceId;
      openSpan.end(openSpanEndTime);
      rootSpan.end();
      return traceId;
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

const imageFile = process.argv[2] || "input/dontpeek.png";
const rootContext = otel.context.active();
sdk
  .start()
  .then(() => main(rootContext, imageFile))
  .then(() => sdk.shutdown());
