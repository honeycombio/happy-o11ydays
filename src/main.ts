import { sdk } from "./initialize-tracing";
import { Pixels, readImage } from "./image";

import otel, { Context } from "@opentelemetry/api";
import { checkAuthorization, findLinkToDataset } from "./honeyApi";
import { HeatmapSpanSpec, convertPixelsToSpans } from "./heatmap";
import { addStackedGraphAttributes } from "./stackedGraph";
import { initializeDataset } from "./dataset";
import { buildPicturesInWaterfall, TraceSpanSpec } from "./waterfall";
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
  await checkAuthorization();
  await initializeDataset();

  console.log(greeting);

  const pixels = readImage(imageFile);

  const spanSpecs = planSpans(pixels);

  const sentSpanContext = sendSpans(rootContext, spanSpecs);

  const url = await findLinkToDataset(sentSpanContext.traceId);
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
