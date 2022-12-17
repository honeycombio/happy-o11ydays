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

type WaterfallImageRow = { start: number; width: number };

function readImageData(filename: string): WaterfallImageRow[] {
  const pixels = readImage(filename);

  const rows = range(0, pixels.height).map((y) => {
    const start = range(0, pixels.width).find(
      (x) => pixels.at(x, y).color.darkness() > 0
    );
    if (start === undefined) {
      return undefined;
    }
    const possibleWidth = range(start, pixels.width).findIndex(
      (x) => pixels.at(x, y).color.darkness() === 0
    );
    const width = possibleWidth === -1 ? pixels.width - start : possibleWidth;
    return {
      start,
      width,
    };
  });

  return rows.filter((x) => x !== undefined) as WaterfallImageRow[]; // typescript, you're wrong
}

function range(startInclusive: number, endExclusive: number) {
  return [...Array(endExclusive).keys()].map((x) => x + startInclusive);
}

const waterfallImageName = "ornament";

type StartToTimeDelta = (start: number) => DistanceFromRight;
type WidthToWaterfallWidth = (width: number) => FractionOfGranularity;

const nothingSpecialOnTheWaterfall = {
  waterfallWidth: 1,
  popBefore: 1,
  popAfter: 0,
  increment: 1,
};

export function buildPictureInWaterfall<T extends HasTimeDelta>(
  spans: T[]
): Array<T & TraceSpanSpec> {
  const waterfallImageDescriptionWithRoot = [
    { start: 0, width: 0 }, // invent an early root span because I want this at the top of the trace
    ...readImageData("input/ornament.png"),
  ];

  var fitError: FoundASpotError = "Not enough room";
  var fitResult: FoundASpot<T> | null = null;
  var incrementFromTheLeft = 0;
  while (fitError === "Not enough room") {
    [fitResult, fitError] = findASpot(
      spans,
      waterfallImageDescriptionWithRoot,
      incrementFromTheLeft++
    );

    if (fitError === "Give up, there's no way this is gonna fit") {
      console.log("Unable to fit picture...");
      // we are done putting images in there
      return spans.map((s) => ({ ...s, ...nothingSpecialOnTheWaterfall }));
    }
  }

  if (fitResult === null) {
    throw new Error("look typescript. it isn't null");
  }

  const { waterfallImageSpans, availableSpans } = fitResult;
  // ok. now we have an allocated span for each of the picture rows. The rest of the spans are in availableSpans

  const waterfallImageSpecs3 = determineTreeStructure(
    waterfallImageSpans
  ) as Array<T & TraceSpanSpec>; // fuck you typescript, i have spent too much time fighting you

  const unusedSpans = availableSpans.map((s) => ({
    ...s,
    ...nothingSpecialOnTheWaterfall,
  }));

  return [...waterfallImageSpecs3, ...unusedSpans];
}

function proportion<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageRow[],
  increment: number
):
  | {
      calculateTimeDelta: StartToTimeDelta;
      calculateWidth: WidthToWaterfallWidth;
    }
  | "Give up, there's no way this is gonna fit" {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const maxTimeDelta = Math.max(...spans.map((s) => s.time_delta)); // should be 0
  const totalWaterfallWidth = maxTimeDelta - minTimeDelta;
  const waterfallImageWidth = Math.max(
    ...waterfallImageDescription.map((w) => w.start + w.width)
  );
  if (minTimeDelta + increment + waterfallImageWidth > maxTimeDelta) {
    return "Give up, there's no way this is gonna fit";
  }
  const waterfallImagePixelWidth = Math.floor(
    (totalWaterfallWidth / waterfallImageWidth) * 0.6
  );

  return {
    calculateTimeDelta: (start: number) =>
      start * waterfallImagePixelWidth + minTimeDelta + increment,
    calculateWidth: (width: number) => width * waterfallImagePixelWidth,
  };
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

type FoundASpotError =
  | "Not enough room"
  | "Give up, there's no way this is gonna fit"
  | null;
type FoundASpot<T extends HasTimeDelta> = {
  waterfallImageSpans: T[];
  availableSpans: T[];
};
type PossibleFits<T extends HasTimeDelta> =
  | [FoundASpot<T>, null]
  | [null, "Not enough room"]
  | [null, "Give up, there's no way this is gonna fit"];
// typescript makes this hard... use go-style return
function findASpot<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageRow[],
  incrementFromTheLeft: number
): PossibleFits<T> {
  console.log(
    `BEGIN: there are ${spans.length} spans, and increment is ${incrementFromTheLeft}`
  );
  const fitWithinImage = proportion(
    spans,
    waterfallImageDescription,
    incrementFromTheLeft
  );
  if (fitWithinImage === "Give up, there's no way this is gonna fit") {
    return [null, "Give up, there's no way this is gonna fit"];
  }
  const { calculateWidth, calculateTimeDelta } = fitWithinImage;
  const waterfallImageSpecs1 = waterfallImageDescription.map((w, i) => ({
    waterfallImageName,
    waterfallRow: i,
    time_delta: calculateTimeDelta(w.start),
    waterfallWidth: calculateWidth(w.width),
    waterfallImageRoot: i === 0,
  }));
  const availableSpans = groupByTimeDelta(spans);
  try {
    const waterfallImageSpecs2 = waterfallImageSpecs1.map((w, i) => {
      // mutating
      const allocatedSpan = availableSpans[w.time_delta]?.pop();
      if (allocatedSpan === undefined) {
        // time to start looking elsewhere!
        console.log(
          `I was looking for a span at ${w.time_delta} for row ${i} but there weren't enough`
        );
        console.log(
          "I needed " +
            waterfallImageSpecs1.filter((w2) => w2.time_delta === w.time_delta)
              .length
        );
        console.log(
          "but there were " +
            spans.filter((s) => s.time_delta === w.time_delta).length
        );
        console.log("TODO: keep looking for a spot we can fit this");
        throw "Not enough room"; // i'm being lazy
      }
      return { ...w, ...allocatedSpan };
    });
    return [
      {
        waterfallImageSpans: waterfallImageSpecs2 as any, // fuck you typescript
        availableSpans: Object.values(availableSpans).flat(),
      },
      null,
    ];
  } catch (e) {
    if (e === "Not enough room") return [null, e];
    throw e; // unexpected
  }
}
