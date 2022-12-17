import { readImage } from "./image";

export type FractionOfGranularity = number;

type DistanceFromRight = number; // nonpositive integer
type HasTimeDelta = { time_delta: DistanceFromRight };
export type TraceSpanSpec = {
  increment: number;
  waterfallWidth: FractionOfGranularity;
  popBefore: number;
  popAfter: number;
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
  const waterfallImageDescriptionWithRoot = [
    { start: 0, width: 0 },
    ...waterfallImageDescription,
  ];
  const waterfallImageSpecs1 = waterfallImageDescriptionWithRoot.map(
    (w, i) => ({
      waterfallImageName,
      waterfallRow: i,
      time_delta: w.start * waterfallImagePixelWidth + minTimeDelta,
      waterfallWidth: w.width * waterfallImagePixelWidth,
      waterfallImageRoot: i === 0,
    })
  );
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
  var parentTimeDeltas: DistanceFromRight[] = [];
  const waterfallImageSpecs3 = waterfallImageSpecs2.map((w) => {
    // if the one above me is to the right, don't pop any.
    var popBefore: DistanceFromRight;
    if (w.waterfallImageRoot) {
      popBefore = 1; // this is the default. Sibling of whatever is above.
    } else {
      // clean this up later
      const theRowAboveMe = parentTimeDeltas[0];
      if (theRowAboveMe === undefined) {
        throw new Error("wtf");
      }
      if (theRowAboveMe > w.time_delta) {
        // I must be its child, or I can't start before it does and also appear below it
        popBefore = 0;
      } else {
        // I can be a sibling, because I start later or at the same time.
        // but! I might be able to pop again
        popBefore = 0;
        while (parentTimeDeltas[0] <= w.time_delta) {
          popBefore++;
          parentTimeDeltas.shift();
        }
      }
    }
    parentTimeDeltas.unshift(w.time_delta);
    return {
      ...w,
      popBefore,
      popAfter: 0,
    };
  });
  // any remaining parents, we need to pop them after for cleanup.
  waterfallImageSpecs3[waterfallImageSpecs3.length - 1].popAfter =
    parentTimeDeltas.length;

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
    // ...Object.values(availableSpans)
    //   .flat()
    //   .map((s) => ({ ...s, waterfallWidth: 1, popBefore: 1, popAfter: 0 })),
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
