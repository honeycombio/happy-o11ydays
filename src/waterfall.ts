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
    (totalWaterfallWidth / waterfallImageWidth) * 0.6
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
  const waterfallImageSpecs3 = determineTreeStructure(waterfallImageSpecs2);

  const waterfallImageSpans = waterfallImageSpecs3.map((w) => {
    const { allocatedSpan, ...rest } = w;
    return {
      ...allocatedSpan,
      ...rest,
    };
  });

  const unusedSpans = Object.values(availableSpans)
    .flat()
    .map((s) => ({
      ...s,
      waterfallWidth: 1,
      popBefore: 1,
      popAfter: 0,
      increment: 1,
    }));

  return [...waterfallImageSpans, ...unusedSpans];
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

function determineTreeStructure<T extends HasTimeDelta>(specsSoFar: T[]) {
  var parentTimeDeltas: Array<{
    time_delta: DistanceFromRight;
    increment: number;
  }> = [];
  const waterfallImageSpecs3 = specsSoFar.map((w, i) => {
    // if the one above me is to the right, don't pop any.
    var popBefore: DistanceFromRight = 0;
    var increment: number = 0;
    if (i === 0) {
      // this is the root of the image
      popBefore = 1; // this is the default. Sibling of whatever is above.
      increment = 0; // random placement :-/
    } else {
      while (
        parentTimeDeltas[0].time_delta <= w.time_delta &&
        parentTimeDeltas.length > 1 // always be a child of the root please
      ) {
        increment = parentTimeDeltas[0].increment + 1;
        popBefore++;
        parentTimeDeltas.shift();
      }
    }
    parentTimeDeltas.unshift({ time_delta: w.time_delta, increment });
    return {
      ...w,
      popBefore,
      popAfter: 0,
      increment,
    };
  });
  // any remaining parents, we need to pop them after for cleanup.
  waterfallImageSpecs3[waterfallImageSpecs3.length - 1].popAfter =
    parentTimeDeltas.length;

  return waterfallImageSpecs3;
}
