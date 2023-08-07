import { sdk } from "./initialize-tracing";

import otel, { Context } from "@opentelemetry/api";
import { convertPixelsToWhatItsGonnaLookLike } from "./convertToHeatmap";
import { spaninate } from "./tracing";
import { Color, Pixels, readImage } from "./image";

export const HISTOGRAM_COLOR_RANGE_OLD = [
  "#ffffff", // 0 spans means white
  "#8ed2b9",
  "#4fb6bd",
  "#3ba2ba",
  "#278fb8",
  "#137fb5",
  "#2769ae",
  "#3758a7",
  "#42439a",
  "#3b287d",
  "#320656",
];

const OUTPUT_FILENAME = "heatmap-output.png";

async function main(rootContext: Context, imageFile: string) {
  const pixels = spaninate("read image", () => readImage(imageFile));

  const outputPixels: Pixels = spaninate("convert image", () =>
    convertPixelsToWhatItsGonnaLookLike({
      pixels,
      histogramColors: HISTOGRAM_COLOR_RANGE_OLD,
    })
  );

  spaninate("write image", () => outputPixels.writeToFile(OUTPUT_FILENAME));

  // needed this once. Now the output is in defaultConfig.json
  // console.log(
  //   '"blueChannelToDensity": ' + JSON.stringify(bluenessToDensityFunction(HISTOGRAM_COLOR_RANGE_OLD.slice(1)))
  // );
}

function bluenessToDensityFunction(histogramColors: string[]) {
  const result: Record<number, number> = {};
  // i don't remember how to do the clever reduce-to-object in js, whatevs
  histogramColors.forEach(
    // the blueness is inverted because that's happening in the heatmap.ts
    // I don't like it but changing it is work, because i have to fix o11ydays if I do
    (hex, n) => (result[255 - Color.fromHex(hex).blue] = n + 1)
  );
  return result;
}

const tracer = otel.trace.getTracer("setup.ts");

const imageFile = process.argv[2];
const rootContext = otel.context.active();
sdk
  .start()
  .then(() =>
    tracer.startActiveSpan("setup main", (s) =>
      main(rootContext, imageFile).then(
        () => {
          s.end();
        },
        (e) => {
          s.recordException(e);
          s.end();
          console.log(e); // do catch it, so that the sdk will shutdown and we will get the whole trace
        }
      )
    )
  )
  .then(() => sdk.shutdown());
