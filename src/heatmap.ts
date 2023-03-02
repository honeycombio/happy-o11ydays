import { AttributesByRedness, populateAttributes } from "./bubbleUp";
import { Pixel, Pixels } from "./image";
import { spaninate } from "./tracing";

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

export type SecondsSinceEpoch = number;
export type Seconds = number;
export type Nanoseconds = number;
export type HrTime = [SecondsSinceEpoch, Nanoseconds];
export const Granularity: Seconds = 5;

type CountOfSpans = number; // 0 to maxSpansAtOnePoint
type NegativeIntegerPixelsFromRight = number;
export type HeatmapSpanSpec = {
  time_delta: NegativeIntegerPixelsFromRight;
  height: number;
  spans_at_once: CountOfSpans;
};

type RowInPng = number; // distance from the top of the png, in pixels. Int
type HeatmapHeight = number; // the height we should heatmap on. float. NEVER a whole number

export type HeatmapConfig = {
  pixels: Pixels;
  bluenessToEventDensity?: Record<number, number>;
  attributesByRedness: AttributesByRedness;
};
export function convertPixelsToSpans({
  pixels,
  attributesByRedness,
  bluenessToEventDensity,
}: HeatmapConfig) {
  const visiblePixels = pixels.all().filter((p) => p.color.darkness() > 0);

  const spansForColor = approximateColorByNumberOfSpans(
    bluenessToEventDensity,
    visiblePixels
  );
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
          ...populateAttributes(attributesByRedness, p), // for bubble up
        }));
    })
    .flat();

  return heatmapSpanSpecs;
}

export function approximateColorByNumberOfSpans(
  inputBluenessToEventDensity: Record<number, number> | undefined,
  allPixels: Pixel[]
): (d: Pixel) => CountOfSpans {
  return spaninate("decide how many pixels to send per color", (s) => {
    const bluenesses = allPixels.map((p) => 255 - p.color.blue);
    const distinctBluenesses = [...new Set(bluenesses)].sort();
    s.setAttribute("app.bluenesses", JSON.stringify(distinctBluenesses));
    s.setAttribute(
      "app.configuredBluenessFunction",
      JSON.stringify(inputBluenessToEventDensity || "none")
    );

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
      ...(inputBluenessToEventDensity || {}), // if they configured one, that takes precedence
    };
    s.setAttribute(
      "app.bluenessDensityFunction",
      JSON.stringify(derivedBluenessToEventDensity)
    );

    return (p) => bluenessToEventDensity[255 - p.color.blue];
  });
}

function incrementEventDensity(distinctBluenesses: number[]) {
  return Object.fromEntries(distinctBluenesses.map((b, i) => [b, i + 1]));
}

function calculateDensitySmoothly(
  maxSpansAtOnePoint: number,
  distinctBluenesses: number[]
): Record<number, number> {
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

export function placeVerticallyInBuckets(
  visiblePixels: Pixel[],
  imageHeight: number
): (y: RowInPng) => HeatmapHeight {
  const pictureHeight =
    imageHeight - Math.min(...visiblePixels.map((p) => p.location.y));
  const imageBase =
    imageHeight - Math.max(...visiblePixels.map((p) => p.location.y));
  const imageHeightRange = pictureHeight - imageBase + 1;
  if (imageHeightRange > 50) {
    console.log(
      "WARNING: The picture is too tall. Make its content 25-50 pixels high"
    );
  }
  if (imageHeightRange <= 25) {
    console.log(
      "WARNING: The picture is too short. Make its content 25-50 pixels high"
    );
  }
  var predictedStepSize = 1.6777216; // this is just what it is. 0.0000001 * 2^24
  return (y) =>
    (imageHeight - y - imageBase + 0.5) * predictedStepSize + imageBase + 0.01;
}

export function placeHorizontallyInBucket(
  begin: SecondsSinceEpoch,
  howFarToTheRight: number,
  increment: number
): HrTime {
  return [begin + howFarToTheRight * Granularity, increment * 1000];
}

type FractionOfGranularity = number;
export function planEndTime(
  startTime: HrTime,
  duration: FractionOfGranularity
): HrTime {
  return addSecondsToHrTime(startTime, duration * Granularity);
}

function addSecondsToHrTime(start: HrTime, seconds: number): HrTime {
  const [sec, ns] = start;

  const additionalSeconds = Math.floor(seconds);
  const additionalNanos = (seconds - additionalSeconds) * 1000000;

  return [sec + additionalSeconds, ns + additionalNanos];
}
