import { Pixel, Pixels, readImage } from "./image";
import { SpanSong } from "./song";

type HasTimeDelta = { time_delta: DistanceFromRight };
export type FractionOfGranularity = number;
export type TraceSpanSpec = {
  name: string;
  increment: number;
  waterfallWidth: FractionOfGranularity;
  popBefore: number;
  popAfter: number;
} & MightBeASpanEvent;
type MightBeASpanEvent = { spanEvent: boolean };

type WaterfallImageRow = {
  start: number;
  width: number;
  sparkle?: boolean;
  waterfallColor: string;
};
type DistanceFromRight = number; // nonpositive integer
type StartToTimeDelta = (start: number) => DistanceFromRight;
type WidthToWaterfallWidth = (width: number) => FractionOfGranularity;

const nothingSpecialOnTheWaterfall = {
  waterfallWidth: 1,
  popBefore: 1,
  popAfter: 0,
  increment: 1,
  spanEvent: true,
};

/**
 * The pictures here are .pngs with characteristics:
 * each row has one contiguous line of pixels representing the span. It gets a start and a width.
 * each row can also have sparkles, which turn into span events.
 * Represent the span with a color containing blue, but no red.
 * Represent a sparkle with any amount of red.
 */
type ImageSource = { filename: string; waterfallImageName: string };
const IMAGE_SOURCES = [
  Array(10).fill({
    filename: "input/bigger-tree.png",
    waterfallImageName: "Christmas tree",
  }),
  Array(1).fill({
    filename: "input/tiny-tree.png",
    waterfallImageName: "baby tree",
  }),
  Array(1).fill({
    filename: "input/bee.png",
    waterfallImageName: "Christmas bee",
  }),
  Array(20).fill({
    filename: "input/ornament.png",
    waterfallImageName: "ornament",
  }),
].flat();

export function buildPicturesInWaterfall<T extends HasTimeDelta>(
  spans: T[]
): Array<T & TraceSpanSpec> {
  const result = reduceUntilStop(
    IMAGE_SOURCES,
    (resultsSoFar, img, i) => {
      const [newResult, err] = buildOnePicture(resultsSoFar.rest, img);
      if (err) {
        console.log(`${i} pictures built into trace`);
        return "stop";
      }
      return {
        imageSpans: [...resultsSoFar.imageSpans, newResult.imageSpans],
        rest: newResult.rest,
      };
    },
    {
      imageSpans: [] as Array<Array<T & TraceSpanSpec>>,
      rest: spans,
    }
  );

  shuffleRoots(result.imageSpans); // mutates
  const imageSpans = assignNames(result.imageSpans);
  return [
    ...result.rest.map((s) => ({
      ...s,
      ...nothingSpecialOnTheWaterfall,
      name: "hello there",
    })),
    ...imageSpans,
  ];
}

function assignNames<T extends HasTimeDelta & TraceSpanSpec>(
  images: T[][]
): T[] {
  function byRootStartTime(a: T[], b: T[]) {
    return a[0].time_delta - b[0].time_delta;
  }
  images.sort(byRootStartTime);
  const song = new SpanSong("input/song.txt");
  images.forEach((im, i1) => {
    im.forEach((s, i2) => {
      if (!s.spanEvent) {
        s.name = song.nameThisSpan();
      }
    });
    song.nextVerse();
  });
  const flattened = images.flat();
  return flattened;
}

// https://dev.to/codebubb/how-to-shuffle-an-array-in-javascript-2ikj
// mutating
function shuffleArray<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// mutating.
// changes the starts of the roots around so the pictures aren't all in a row
function shuffleRoots<T extends HasTimeDelta>(
  imagesInWaterfall: Array<Array<T>>
) {
  const roots = imagesInWaterfall.map((ii) => ii[0]);
  shuffleArray(roots);
  imagesInWaterfall.forEach((imageRows, i) => (imageRows[0] = roots[i]));
}

type BuildOnePictureOutcome<T extends HasTimeDelta> = [
  { imageSpans: Array<T & TraceSpanSpec>; rest: T[] },
  "Give up, there's no way this is gonna fit" | null
];
function buildOnePicture<T extends HasTimeDelta>(
  spans: T[],
  { filename, waterfallImageName }: ImageSource
): BuildOnePictureOutcome<T> {
  const waterfallImageDescriptionWithRoot = [
    { start: 0, width: 0, waterfallColor: "none" }, // invent an early root span because I want this at the top of the trace
    ...readImageData(filename),
  ];

  const maxIncrement = maxIncrementThatMightStillFit(
    spans,
    waterfallImageDescriptionWithRoot
  );
  const possibleIncrements = range(0, maxIncrement + 1);
  shuffleArray(possibleIncrements);
  const finalFitResult: "fail" | FoundASpot<T> = findResult(
    possibleIncrements,
    (incrementFromTheLeft) => {
      const [fitResult, fitError] = findASpot(
        spans,
        waterfallImageDescriptionWithRoot,
        incrementFromTheLeft++
      );
      if (fitError) {
        return "fail";
      }
      return fitResult;
    }
  );

  if (finalFitResult === "fail") {
    // we are done putting images in there
    return [
      { imageSpans: [], rest: spans },
      "Give up, there's no way this is gonna fit",
    ];
  }

  const { waterfallImageSpans, availableSpans } = finalFitResult;
  // ok. now we have an allocated span for each of the picture rows. The rest of the spans are in availableSpans

  const waterfallImageSpecs3 = determineTreeStructure(
    waterfallImageSpans
  ) as Array<T & TraceSpanSpec>; // fuck you typescript, i have spent too much time fighting you

  return [
    {
      imageSpans: waterfallImageSpecs3.map((s) => ({
        ...s,
        waterfallImageName,
      })),
      rest: availableSpans,
    },
    null,
  ];
}

function maxIncrementThatMightStillFit(
  spans: HasTimeDelta[],
  waterfallImageDescription: WaterfallImageRow[]
) {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const maxTimeDelta = Math.max(...spans.map((s) => s.time_delta)); // should be 0
  const waterfallImageWidth = Math.max(
    ...waterfallImageDescription.map((w) => w.start + w.width)
  );
  const biggestTimeDeltaThatMightFit = maxTimeDelta - waterfallImageWidth;
  const maxIncrementFromLeft = biggestTimeDeltaThatMightFit - minTimeDelta;

  return maxIncrementFromLeft;
}

function proportion<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageRow[],
  increment: number
): {
  calculateTimeDelta: StartToTimeDelta;
  calculateWidth: WidthToWaterfallWidth;
} {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const maxTimeDelta = Math.max(...spans.map((s) => s.time_delta)); // should be 0
  if (minTimeDelta + increment > maxTimeDelta) {
    throw new Error(
      `Invalid increment: ${increment}. Waterfall is only ${
        maxTimeDelta - minTimeDelta
      } wide`
    );
  }
  const totalWaterfallWidth = maxTimeDelta - minTimeDelta;
  const waterfallImageWidth = Math.max(
    ...waterfallImageDescription.map((w) => w.start + w.width)
  );
  const waterfallImagePixelWidth = Math.floor(
    (totalWaterfallWidth / waterfallImageWidth) * 0.6
  );

  return {
    calculateTimeDelta: (start: number) =>
      start * waterfallImagePixelWidth + minTimeDelta + increment,
    calculateWidth: (width: number) => width * waterfallImagePixelWidth,
  };
}

function readImageData(filename: string): WaterfallImageRow[] {
  const pixels = readImage(filename);

  function hasSomeBlue(p: Pixel): boolean {
    // exclude white
    return p.color.blue > 0 && p.color.darkness() > 0;
  }

  const rows = range(0, pixels.height).map((y) => {
    const start = range(0, pixels.width).find((x) =>
      hasSomeBlue(pixels.at(x, y))
    );
    if (start === undefined) {
      return undefined; // filter these out later
    }
    const possibleWidth = range(start, pixels.width).findIndex(
      (x) => !hasSomeBlue(pixels.at(x, y))
    );
    const width = possibleWidth === -1 ? pixels.width - start : possibleWidth;
    const representativePixel = pixels.at(start, y); // not good if there's a sparkle there
    return [
      {
        start,
        width,
        waterfallPixel: representativePixel.asFlatJson(),
        waterfallColor: representativePixel.color.toString(),
      },
      ...findSparkles(pixels, y),
    ];
  });

  return rows.flat().filter((x) => x !== undefined) as WaterfallImageRow[]; // typescript, you're wrong
}

function findSparkles(pixels: Pixels, y: number): WaterfallImageRow[] {
  return range(0, pixels.width)
    .map((x) => pixels.at(x, y))
    .filter((p) => p.color.red > 0 && p.color.darkness() > 0)
    .map((p) => ({
      start: p.location.x,
      width: 0,
      sparkle: true,
      waterfallColor: p.color.toString(),
    }));
}

function range(startInclusive: number, endExclusive: number) {
  return [...Array(endExclusive).keys()].map((x) => x + startInclusive);
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

function determineTreeStructure<T extends HasTimeDelta & MightBeASpanEvent>(
  specsSoFar: T[]
) {
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
      increment = 0; // random placement for the root :-/
    } else if (w.spanEvent) {
      // it does not participate in the tree structure. bypass
      return {
        ...w,
        popBefore: 1,
        popAfter: 0,
        increment: 0,
      };
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

type FoundASpot<T extends HasTimeDelta> = {
  waterfallImageSpans: Array<T & MightBeASpanEvent>;
  availableSpans: T[];
};
type PossibleFits<T extends HasTimeDelta> =
  | [FoundASpot<T>, null]
  | [null, "Not enough room"];
// typescript makes this hard... use go-style return
function findASpot<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageRow[],
  incrementFromTheLeft: number
): PossibleFits<T> {
  const fitWithinImage = proportion(
    spans,
    waterfallImageDescription,
    incrementFromTheLeft
  );
  const { calculateWidth, calculateTimeDelta } = fitWithinImage;
  const waterfallImageSpecs1 = waterfallImageDescription.map((w, i) => ({
    time_delta: calculateTimeDelta(w.start),
    waterfallWidth: calculateWidth(w.width),
    spanEvent: w.sparkle || false,
    rowColor: w.waterfallColor,
    waterfallSpec: JSON.stringify({
      row: i,
      imageRoot: i === 0,
      ...w,
    }),
  }));
  var availableSpans = groupByTimeDelta(spans);
  const placementResult = mapUntilFail(waterfallImageSpecs1, (w, i) => {
    // mutating
    const allocatedSpan = availableSpans[w.time_delta]?.pop();
    if (allocatedSpan === undefined) {
      // time to start looking elsewhere!
      return "fail";
    }
    return { ...w, ...allocatedSpan };
  });
  if (placementResult === "fail") {
    return [null, "Not enough room"];
  }
  return [
    {
      waterfallImageSpans: placementResult,
      availableSpans: Object.values(availableSpans).flat(),
    },
    null,
  ];
}

// what I really want is an iteratee, so I'll just make one
function reduceUntilStop<T, R>(
  arr: T[],
  fn: (prev: R, e: T, i: number) => R | "stop",
  init: R
): R {
  var output = init;
  for (var i = 0; i < arr.length; i++) {
    const result = fn(output, arr[i], i);
    if (result === "stop") {
      return output;
    } else {
      output = result;
    }
  }
  return output;
}

function mapUntilFail<T, R>(
  arr: T[],
  fn: (e: T, i: number) => R | "fail"
): R[] | "fail" {
  var output: R[] = [];
  for (var i = 0; i < arr.length; i++) {
    const result = fn(arr[i], i);
    if (result === "fail") {
      return "fail";
    } else {
      output[i] = result;
    }
  }
  return output;
}

function findResult<T, R>(
  arr: T[],
  fn: (e: T, i: number) => R | "fail"
): R | "fail" {
  for (var i = 0; i < arr.length; i++) {
    const result = fn(arr[i], i);
    if (result !== "fail") {
      return result;
    }
  }
  return "fail";
}
