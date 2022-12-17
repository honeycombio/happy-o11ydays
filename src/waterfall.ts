import { readImage } from "./image";

export type FractionOfGranularity = number;
type HasTimeDelta = { time_delta: number };
export type TraceSpanSpec = {
  increment: number;
  duration: FractionOfGranularity;
};
export function addTraceArtSpecs<T extends HasTimeDelta>(
  graphSpanSpecs: T[]
): Array<T & TraceSpanSpec> {
  // inner class so that it has access to T
  class IncrementMarker {
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
        duration: 1 / this.increment,
      };
    };
  }

  function byTimeDelta(a: { time_delta: number }, b: { time_delta: number }) {
    return b.time_delta - a.time_delta;
  }

  const orderedSpecs = graphSpanSpecs
    .sort(byTimeDelta)
    .map(new IncrementMarker().mark);

  return orderedSpecs;
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

type DistanceFromLeft = number; // nonpositive integer
type WidthInPixels = number; // positive integer
type IntermediateWaterfallSpanSpec<T extends HasTimeDelta> = {
  time_delta: DistanceFromLeft,
  waterfallWidth: WidthInPixels,
  allocatedSpan?: T
}
function buildPicture<T extends HasTimeDelta>(
  spans: T[]
): Array<T & TraceSpanSpec> {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const waterfallImageSpecs : Array<IntermediateWaterfallSpanSpec<T>> = waterfallImageDescription.map((w) => ({
    time_delta: w.start + minTimeDelta,
    waterfallWidth: w.width,
  }));
  const availableSpans = groupByTimeDelta(spans);
  waterfallImageSpecs.forEach((w) => { // mutating
    const allocatedSpan = availableSpans[w.time_delta].pop();
    if (allocatedSpan === undefined) {
      // time to start looking elsewhere!
      console.log("TODO: keep looking for a spot we can fit this");
    } else {
      w.allocatedSpan = allocatedSpan;
    }
    return w;
  });
  // ok. now we have an allocated span for each of the picture rows. The rest of the spans are in availableSpans
  w.map()

  return [];
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
