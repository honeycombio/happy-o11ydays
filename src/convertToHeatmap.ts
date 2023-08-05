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

export type ConvertPixelsInput = {
  pixels: Pixels;
  histogramColors: string[]; // 11 hex colors, starting with white
};

export function convertPixelsToWhatItsGonnaLookLike({
  pixels,
  histogramColors,
}: ConvertPixelsInput) {
  const visiblePixels = pixels.all().filter((p) => p.color.darkness() > 0);

  const spansForColor = approximateColorByNumberOfSpans(visiblePixels);

  visiblePixels
    .map((p) => p.withColor(Color.fromHex(histogramColors[spansForColor(p)])))
    .map((p) => pixels.overwrite(p));
  pixels.writeToFile("heatmap-version.png"); // TODO: move this to main
}

export function approximateColorByNumberOfSpans(
  allPixels: Pixel[]
): (d: Pixel) => CountOfSpans {
  return spaninate("decide how many pixels to send per color", (s) => {
    const darknesses = allPixels.map((p) => p.color.darkness());
    const distinctDarknesses = [...new Set(darknesses)].sort();
    s.setAttribute("app.darknesses", JSON.stringify(distinctDarknesses));

    s.setAttribute("app.distinctDarknessCount", distinctDarknesses.length);
    if (distinctDarknesses.length === 1) {
      // there is only one color, so one span per dot
      return (p) => 1;
    }

    const maxSpansAtOnePoint = 10.0; // this is tied to the length of histogramColors
    s.setAttribute("app.maxSpansAtOnePoint", maxSpansAtOnePoint);
    const derivedDarknessToEventDensity: Record<number, number> =
      distinctDarknesses.length > maxSpansAtOnePoint
        ? calculateDensitySmoothly(maxSpansAtOnePoint, distinctDarknesses)
        : incrementEventDensity(distinctDarknesses);
    s.setAttribute(
      "app.derivedDarknessDensityFunction",
      JSON.stringify(derivedDarknessToEventDensity)
    );

    return (p) => derivedDarknessToEventDensity[p.color.darkness()];
  });
}

function incrementEventDensity(distinctBluenesses: number[]) {
  otel.trace
    .getActiveSpan()
    ?.setAttribute("app.bluenessCalculationStrategy", "increment");
  return Object.fromEntries(distinctBluenesses.map((b, i) => [b, i + 1]));
}

// returns a function expressed as a map, with
// range: each number in distinctDarknesses
// domain: integers from [0, maxSpansAtOnePoint]
function calculateDensitySmoothly(
  maxSpansAtOnePoint: number,
  distinctDarknesses: number[]
): Record<number, number> {
  otel.trace
    .getActiveSpan()
    ?.setAttribute("app.bluenessCalculationStrategy", "smooth");
  const maxBlueness = Math.max(...distinctDarknesses);
  const bluenessWidth = maxBlueness;
  const increaseInSpansPerBlueness =
    bluenessWidth === 0 ? 1 : maxSpansAtOnePoint / bluenessWidth;
  const bluenessFunction = (b: number) =>
    maxSpansAtOnePoint -
    Math.round((maxBlueness - b) * increaseInSpansPerBlueness);

  return Object.fromEntries(
    distinctDarknesses.map((b) => [b, bluenessFunction(b)])
  );
}
