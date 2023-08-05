import { Color, Pixel, Pixels } from "./image";
import { spaninate } from "./tracing";
import otel from "@opentelemetry/api";

/**
 * Draw an image using spans on a heatmap.
 *
 * The image needs to be 25-50 pixels high.
 * To fit in the last 10 minutes graph, be about 120 pixels wide.
 * the BLUE channel is what matters for the heatmap; RED and GREEN are ignored.
 * Transparent and white pixels are skipped.
 *
 * (RED can determine attributes; see bubbleUp.ts)
 */

type CountOfSpans = number; // 0 to maxSpansAtOnePoint

// This bit is a utility to convert your PNG to what it will look like on a heatmap

// this constant is copied from Poodle
export const HISTOGRAM_COLOR_RANGE_OLD = [
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
export function convertPixelsToWhatItsGonnaLookLike(pixels: Pixels) {
  const visiblePixels = pixels.all().filter((p) => p.color.darkness() > 0);

  const spansForColor = approximateColorByNumberOfSpans(visiblePixels);

  visiblePixels
    .map((p) =>
      p.withColor(
        Color.fromHex(HISTOGRAM_COLOR_RANGE_OLD[spansForColor(p) - 1])
      )
    )
    .map((p) => pixels.overwrite(p));
  pixels.writeToFile("heatmap-version.png"); // TODO: move this to main
}

export function approximateColorByNumberOfSpans(
  allPixels: Pixel[]
): (d: Pixel) => CountOfSpans {
  return spaninate("decide how many pixels to send per color", (s) => {
    const bluenesses = allPixels.map((p) => 255 - p.color.blue);
    const distinctBluenesses = [...new Set(bluenesses)].sort();
    s.setAttribute("app.bluenesses", JSON.stringify(distinctBluenesses));

    s.setAttribute("app.distinctBluenessCount", distinctBluenesses.length);
    if (distinctBluenesses.length === 1) {
      // there is only one color, so one span per dot
      return (p) => 1;
    }

    const maxSpansAtOnePoint = 10.0;
    s.setAttribute("app.maxSpansAtOnePoint", maxSpansAtOnePoint);
    const derivedBluenessToEventDensity: Record<number, number> =
      distinctBluenesses.length > maxSpansAtOnePoint
        ? calculateDensitySmoothly(maxSpansAtOnePoint, distinctBluenesses)
        : incrementEventDensity(distinctBluenesses);
    s.setAttribute(
      "app.derivedBluenessDensityFunction",
      JSON.stringify(derivedBluenessToEventDensity)
    );
    const bluenessToEventDensity = {
      ...derivedBluenessToEventDensity,
    };
    s.setAttribute(
      "app.bluenessDensityFunction",
      JSON.stringify(bluenessToEventDensity)
    );

    return (p) => bluenessToEventDensity[255 - p.color.blue];
  });
}

function incrementEventDensity(distinctBluenesses: number[]) {
  otel.trace
    .getActiveSpan()
    ?.setAttribute("app.bluenessCalculationStrategy", "increment");
  return Object.fromEntries(distinctBluenesses.map((b, i) => [b, i + 1]));
}

function calculateDensitySmoothly(
  maxSpansAtOnePoint: number,
  distinctBluenesses: number[]
): Record<number, number> {
  otel.trace
    .getActiveSpan()
    ?.setAttribute("app.bluenessCalculationStrategy", "smooth");
  const maxBlueness = Math.max(...distinctBluenesses);
  const bluenessWidth = maxBlueness - Math.min(...distinctBluenesses);
  const increaseInSpansPerBlueness =
    bluenessWidth === 0 ? 1 : (maxSpansAtOnePoint - 1) / bluenessWidth;
  const bluenessFunction = (b: number) =>
    maxSpansAtOnePoint -
    Math.round((maxBlueness - b) * increaseInSpansPerBlueness);

  return Object.fromEntries(
    distinctBluenesses.map((b) => [b, bluenessFunction(b)])
  );
}
