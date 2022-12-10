import { Pixel } from "./image";

export type SecondsSinceEpoch = number;
export type Seconds = number;
export type Nanoseconds = number;
export type HrTime = [SecondsSinceEpoch, Nanoseconds];
export const Granularity: Seconds = 5;

type CountOfSpans = number; // 0 to maxSpansAtOnePoint
export type HeatmapSpanSpec = {
  time_delta: number;
  height: number;
  spans_at_once: CountOfSpans;
};

type RowInPng = number; // distance from the top of the png, in pixels. Int
type HeatmapHeight = number; // the height we should heatmap on. float. NEVER a whole number

export function approximateColorByNumberOfSpans(
  allPixels: Pixel[]
): (d: Pixel) => CountOfSpans {
  const bluenesses = allPixels.map((p) => 255 - p.color.blue);
  const maxBlueness = Math.max(...bluenesses);
  const bluenessWidth = maxBlueness - Math.min(...bluenesses);
  if (bluenessWidth === 0) {
    // there is only one color. We only ever need to send 1 span.
    return (d) => 1;
  }
  const maxSpansAtOnePoint = 10.0;
  const increaseInSpansPerBlueness =
    bluenessWidth === 0 ? 1 : (maxSpansAtOnePoint - 1) / bluenessWidth;
  return (p: Pixel) =>
    maxSpansAtOnePoint -
    Math.round(
      (maxBlueness - (255 - p.color.blue)) * increaseInSpansPerBlueness
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
  howFarToTheRight: number
): HrTime {
  return [begin + howFarToTheRight * Granularity, 0];
}
