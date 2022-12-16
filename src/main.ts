import { sdk } from "./tracing";
import { Pixels, readImage } from "./image";
import { populateAttributes } from "./bubbleUp";

import otel from "@opentelemetry/api";
import { findLinkToDataset } from "./honeyApi";
import {
  approximateColorByNumberOfSpans,
  placeHorizontallyInBucket,
  placeVerticallyInBuckets,
  SecondsSinceEpoch,
  HeatmapSpanSpec,
  planEndTime,
} from "./heatmap";
import { addStackedGraphAttributes } from "./stackedGraph";
import { initializeDataset } from "./dataset";

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

  const link = await findLinkToDataset();
  console.log("Run a new query for HEATMAP(height) in this dataset: " + link);

  sdk.shutdown();
  console.log("(Pausing to send buffered spans...");
  setTimeout(() => console.log(" hopefully they've all been sent)"), 10000);
}

type SpanSpec = HeatmapSpanSpec & TraceSpanSpec & Record<string, number | string>;

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
  const spanSpecs = addTraceArtSpecs(graphSpanSpecs);

  return spanSpecs;
}

type TraceID = string;
const tracer = otel.trace.getTracer("viz-art");
function sendSpans(spanSpecs: SpanSpec[]): TraceID {
  const begin: SecondsSinceEpoch = Math.ceil(Date.now() / 1000);
  var traceId: string;
  // the root span has no height, so it doesn't appear in the heatmap
  return tracer.startActiveSpan(
    "Deck the halls with boughs of holly",
    (rootSpan) => {
      // create all the spans for the picture
      spanSpecs.sort(byTime).forEach((ss) => {
        const startTime = placeHorizontallyInBucket(begin, ss.time_delta, ss.increment);
        const s = tracer.startSpan("la", {
          startTime,
          attributes: ss,
        });
        const endTime = planEndTime(startTime, ss.duration)
        s.end(endTime);
      });
      traceId = rootSpan.spanContext().traceId;
      rootSpan.end();
      return traceId;
    }
  );
}

const byTime = function (ss1: HeatmapSpanSpec, ss2: HeatmapSpanSpec) {
  return ss2.time_delta - ss1.time_delta;
};

const imageFile = process.argv[2] || "input/dontpeek.png";

main(imageFile);
export type FractionOfGranularity = number;
export type TraceSpanSpec = { increment: number, duration: FractionOfGranularity }
export function addTraceArtSpecs<T extends { time_delta: number }>(
  graphSpanSpecs: T[]
): Array<T & TraceSpanSpec> {
  class IncrementMarker {
    private previous_time_delta: number = -500000; // nonsense
    private increment: number = 0;
    public mark: (ss: T) => T & TraceSpanSpec = (ss: T) => {
      if (ss.time_delta !== this.previous_time_delta) {
        // reset
        this.previous_time_delta = ss.time_delta;
        this.increment = 0;
      }
      return { ...ss, increment: this.increment++, duration: 1 / this.increment };
    }
  }

  function byTimeDelta(a: { time_delta: number }, b: { time_delta: number }) {
    return b.time_delta - a.time_delta;
  }

  const orderedSpecs = graphSpanSpecs
    .sort(byTimeDelta)
    .map(new IncrementMarker().mark);

  return orderedSpecs;
}
