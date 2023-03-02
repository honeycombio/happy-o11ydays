import { sdk } from "./initialize-tracing";
import { Pixels, readImage } from "./image";

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

  const spanSpecs = planSpans(pixels);

  const traceId = sendSpans(rootContext, spanSpecs);

  const link = await findLinkToDataset(traceId);
  console.log("  Run a new query for HEATMAP(height) in this dataset: " + link);

  console.log(
    "  Check the README for how to get the query just right, and see the picture, and then investigate it!\n"
  );
  console.log("  Oh look, I drew a picture: " + url + "\n");
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

const imageFile = process.argv[2] || "input/dontpeek.png";
const rootContext = otel.context.active();
sdk
  .start()
  .then(() => main(rootContext, imageFile))
  .then(() => sdk.shutdown());
