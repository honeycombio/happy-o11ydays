import { sdk } from "./tracing";
import { Pixels, readImage } from "./image";
import { populateAttributes } from "./bubbleUp";
import { SpanSong } from "./song";

import otel, { Context, Span } from "@opentelemetry/api";
import { findLinkToDataset } from "./honeyApi";
import {
  approximateColorByNumberOfSpans,
  placeHorizontallyInBucket,
  placeVerticallyInBuckets,
  SecondsSinceEpoch,
  HeatmapSpanSpec,
  planEndTime,
  HrTime,
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

async function main(imageFile: string) {
  await initializeDataset();

  await sdk.start();
  console.log(greeting);

  const pixels = readImage(imageFile);
  console.log(`Read ${pixels.width}x${pixels.height} image from ${imageFile}`);

  const spanSpecs = planSpans(pixels);
  console.log(`Sending ${spanSpecs.length} spans...`);

  const traceId = sendSpans(spanSpecs);
  console.log("We did it! The trace ID is: " + traceId);

  const link = await findLinkToDataset(traceId);
  console.log("Run a new query for HEATMAP(height) in this dataset: " + link);

  sdk.shutdown();
  console.log("(Pausing to send buffered spans...");
  setTimeout(() => console.log(" hopefully they've all been sent)"), 10000);
}

type SpanSpec = HeatmapSpanSpec &
  TraceSpanSpec &
  Record<string, number | string | boolean>;

function planSpans(pixels: Pixels): SpanSpec[] {
  const visiblePixels = pixels.all().filter((p) => p.color.darkness() > 0);

  const spansForColor = approximateColorByNumberOfSpans(visiblePixels);
  const heatmapHeight = placeVerticallyInBuckets(visiblePixels, pixels.height);

  // turn each pixel into some spans
  const heatmapSpanSpecs = visiblePixels
    .map((p) => {
      const spans_at_once = spansForColor(p);
      return Array(spans_at_once)
        .fill({})
        .map((_) => ({
          ...p.asFlatJson(), // add all the fields, for observability ;-)
          spans_at_once,
          time_delta: p.location.x - pixels.width,
          height: heatmapHeight(p.location.y), // make it noninteger, so hny knows this is a float field
          ...populateAttributes(p), // for bubble up
        }));
    })
    .flat();

  const graphSpanSpecs = addStackedGraphAttributes(heatmapSpanSpecs);
  const spanSpecs = buildPicturesInWaterfall(graphSpanSpecs);

  return spanSpecs;
}

type TraceID = string;
const tracer = otel.trace.getTracer("viz-art");
function sendSpans(spanSpecs: SpanSpec[]): TraceID {
  const begin: SecondsSinceEpoch = Math.ceil(Date.now() / 1000);
  const song = new SpanSong("input/song.txt");
  var traceId: string;
  const earliestTimeDelta = Math.min(...spanSpecs.map((s) => s.time_delta));
  // the root span has no height, so it doesn't appear in the heatmap
  return tracer.startActiveSpan(
    "Deck the halls with boughs of holly",
    { startTime: placeHorizontallyInBucket(begin, earliestTimeDelta, 0) },
    (rootSpan) => {
      // create all the spans for the picture
      var parentContexts: Array<Context> = [];
      var openSpan: Span = rootSpan;
      var openSpanEndTime: HrTime | undefined = undefined;
      spanSpecs.forEach((ss, i) => {
        const startTime = placeHorizontallyInBucket(
          begin,
          ss.time_delta,
          ss.increment
        );
        if (ss.spanEvent) {
          // something completely different
          openSpan.addEvent("sparkle", ss, startTime);
        } else {
          if (openSpan !== rootSpan) {
            openSpan.end(openSpanEndTime);
          }
          for (var i = 0; i < ss.popBefore; i++) {
            parentContexts.shift();
          }
          tracer.startActiveSpan(
            song.nameThisSpan(),
            {
              startTime,
              attributes: ss,
            },
            parentContexts[0] || otel.context.active(),
            (s) => {
              parentContexts.unshift(otel.context.active());
              for (var i = 0; i < ss.popAfter; i++) {
                parentContexts.shift();
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

// mutates its input
function drainAll(parentSpans: Array<[Span, HrTime]>) {
  var endme;
  while ((endme = parentSpans.pop())) {
    const [s, endTime] = endme;
    s.end(endTime);
  }
}

const byTime = function (ss1: HeatmapSpanSpec, ss2: HeatmapSpanSpec) {
  return ss2.time_delta - ss1.time_delta;
};

const imageFile = process.argv[2] || "input/dontpeek.png";

main(imageFile);
