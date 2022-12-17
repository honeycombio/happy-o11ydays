import { readImage } from "./image";

export type FractionOfGranularity = number;

type DistanceFromRight = number; // nonpositive integer
type HasTimeDelta = { time_delta: DistanceFromRight };
export type TraceSpanSpec = {
  increment: number;
  waterfallWidth: FractionOfGranularity;
  childOfPrevious: boolean;
};

class IncrementMarker<
  T extends HasTimeDelta & Omit<TraceSpanSpec, "increment">
> {
  // could be a function that returns the function
  private previous_time_delta: number = -500000; // nonsense
  private increment: number = 0;
  public mark: (ss: T) => T & TraceSpanSpec = (ss: T) => {
    if (ss.time_delta !== this.previous_time_delta) {
      // reset
      this.previous_time_delta = ss.time_delta;
      this.increment = 0;
    }
    return {
      ...ss,
      increment: this.increment++,
    };
  };
}

function readImageData(filename: string) {
  const pixels = readImage(filename);
}

const waterfallImageDescription = [
  { start: 4, width: 1 },
  { start: 4, width: 1 },
  { start: 3, width: 3 },
  { start: 2, width: 5 },
  { start: 1, width: 7 },
  { start: 1, width: 7 },
  { start: 0, width: 9 },
  { start: 0, width: 9 },
  { start: 0, width: 9 },
  { start: 1, width: 7 },
  { start: 1, width: 7 },
  { start: 2, width: 5 },
  { start: 3, width: 3 },
];
const waterfallImageName = "ornament";

export function buildPictureInWaterfall<T extends HasTimeDelta>(
  spans: T[]
): Array<T & TraceSpanSpec> {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const maxTimeDelta = Math.max(...spans.map((s) => s.time_delta)); // should be 0
  const totalWaterfallWidth = maxTimeDelta - minTimeDelta;
  const waterfallImageWidth = Math.max(
    ...waterfallImageDescription.map((w) => w.start + w.width)
  );
  const waterfallImagePixelWidth = Math.floor(
    totalWaterfallWidth / waterfallImageWidth
  );
  const waterfallImageSpecs1 = waterfallImageDescription.map((w, i) => ({
    waterfallImageName,
    waterfallRow: i,
    time_delta: w.start * waterfallImagePixelWidth + minTimeDelta,
    waterfallWidth: w.width * waterfallImagePixelWidth,
  }));
  const availableSpans = groupByTimeDelta(spans);
  const waterfallImageSpecs2 = waterfallImageSpecs1.map((w) => {
    // mutating
    const allocatedSpan = availableSpans[w.time_delta].pop();
    if (allocatedSpan === undefined) {
      // time to start looking elsewhere!
      console.log("TODO: keep looking for a spot we can fit this");
      throw new Error("fail");
    }
    return { ...w, allocatedSpan };
  });
  // ok. now we have an allocated span for each of the picture rows. The rest of the spans are in availableSpans
  const waterfallImageSpecs3 = waterfallImageSpecs2.map(
    (function () {
      var previousTimeDelta: DistanceFromRight | undefined = undefined;
      return (w) => {
        const thisOneStartsBeforeTheOneOnTopOfIt =
          previousTimeDelta !== undefined && w.time_delta < previousTimeDelta;
        previousTimeDelta = w.time_delta;
        return {
          ...w,
          childOfPrevious: thisOneStartsBeforeTheOneOnTopOfIt,
        };
      };
    })()
  );

  type SpecsWithoutIncrement = T & Omit<TraceSpanSpec, "increment">;
  const waterfallImageSpans: SpecsWithoutIncrement[] = waterfallImageSpecs3.map(
    (w) => {
      const { allocatedSpan, ...rest } = w;
      return {
        ...allocatedSpan,
        ...rest,
      };
    }
  );

  const allSpans: Array<T & TraceSpanSpec> = [
    ...waterfallImageSpans,
    ...Object.values(availableSpans)
      .flat()
      .map((s) => ({ ...s, waterfallWidth: 1, childOfPrevious: false })),
  ].map(new IncrementMarker<SpecsWithoutIncrement>().mark);

  return allSpans;
}

function groupByTimeDelta<T extends HasTimeDelta>(
  ss: T[]
): Record<number, T[]> {
  return ss.reduce((p, c) => {
    const k = c.time_delta;
    if (!p.hasOwnProperty(k)) {
      p[k] = [];
    }
    p[k].push(c);
    return p;
  }, {} as Record<number, T[]>);
}
