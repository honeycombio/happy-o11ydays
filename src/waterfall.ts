import { Pixel, Pixels } from "./image";
import { SeededRandom } from "./shuffle";
import { SpanSong } from "./song";
import { spaninate } from "./tracing";
import otel from "@opentelemetry/api";

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

// this is a special behavior for constructing the tree, that works for span events
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
export type WaterfallConfig = {
  waterfallImages: ImageSource[];
  song: SongConfig;
  seededRandom: SeededRandom;
};

type ImageSource = {
  pixels: Pixels;
  waterfallImageName: string;
  maxCount: number;
};
function fetchImageSources(config: ImageSource[]): WaterfallImageDescription[] {
  return config
    .map(({ pixels, maxCount, waterfallImageName }) =>
      Array(maxCount).fill(readWaterfallImageDescription(pixels, waterfallImageName))
    )
    .flat();
}

function drawImagesInSpans<T extends HasTimeDelta>(
  imageSources: WaterfallImageDescription[],
  spans: T[],
  seededRandom: SeededRandom
): { imageSpans: Array<Array<T & TraceSpanSpec>>; rest: T[] } {
  return reduceUntilStop(
    imageSources,
    (resultsSoFar, img, i) => {
      const [newResult, err] = buildOnePicture(resultsSoFar.rest, img, i, seededRandom);
      if (err) {
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
}

export function buildPicturesInWaterfall<T extends HasTimeDelta>(
  config: WaterfallConfig,
  spans: T[]
): Array<T & TraceSpanSpec> {
  const span = otel.trace.getActiveSpan();
  span?.setAttribute("app.waterfallConfig", JSON.stringify(config));
  span?.setAttribute("app.seededRandom", config.seededRandom.toString());

  const result = spaninate("draw images", () =>
    drawImagesInSpans(fetchImageSources(config.waterfallImages), spans, config.seededRandom)
  );

  // commented out to eliminate the complication.
  spaninate("shuffle roots", () => shuffleRoots(config.seededRandom, result.imageSpans)); // mutates

  incrementRoots(result.imageSpans); // mutates
  const imageSpans = assignNames(config.song, result.imageSpans);
  const leftoversAsSpanEvents = result.rest.map((s) => ({
    ...s,
    ...nothingSpecialOnTheWaterfall,
    name: "hello there",
  }));
  return [...leftoversAsSpanEvents, ...imageSpans];
}

type SongConfig = { songLyrics: string };
function assignNames<T extends HasTimeDelta & TraceSpanSpec>(config: SongConfig, images: T[][]): T[] {
  function byRootStartTime(a: T[], b: T[]) {
    return a[0].time_delta - b[0].time_delta;
  }
  images.sort(byRootStartTime);
  otel.trace.getActiveSpan()?.setAttribute("app.songLyrics", config.songLyrics);
  const song = new SpanSong(config.songLyrics);
  images.forEach((im, i1) => {
    im.forEach((s, i2) => {
      if (!s.spanEvent) {
        (s as any)["app.songLocation"] = song.whereAmI();
        s.name = song.nameThisSpan();
      }
    });
    song.nextVerse();
  });
  const flattened = images.flat();
  return flattened;
}

// mutating.
// changes the starts of the roots around so the pictures aren't all in a row
function shuffleRoots<T extends HasTimeDelta>(seededRandom: SeededRandom, imagesInWaterfall: Array<Array<T>>) {
  const roots = imagesInWaterfall.map((ii) => ii[0]);
  seededRandom.shuffleInPlace(roots);
  imagesInWaterfall.forEach((imageRows, i) => (imageRows[0] = roots[i]));
}

function incrementRoots<T extends HasTimeDelta & TraceSpanSpec>(imagesInWaterfall: Array<Array<T>>) {
  spaninate("increment roots", (s) => {
    const roots = imagesInWaterfall.map((ii) => ii[0]);
    roots.sort((r1, r2) => r2.time_delta - r1.time_delta);
    s.setAttribute("app.rootTimeDeltas", roots.map((r) => r.time_delta).join(","));
    for (var i = 1; i < roots.length; i++) {
      const prevRoot = roots[i - 1];
      const root = roots[i];
      if (prevRoot.time_delta === root.time_delta) {
        root.increment = prevRoot.increment + 1;
      }
    }
  }); // mutates
}

type WaterfallImageDescription = {
  rows: WaterfallImageRow[];
  waterfallImageName: string;
};
function readWaterfallImageDescription(pixels: Pixels, waterfallImageName: string): WaterfallImageDescription {
  return {
    rows: [
      { start: 0, width: 0, waterfallColor: "none" }, // invent an early root span because I want this at the top of the trace
      ...readImageData(pixels),
    ],
    waterfallImageName,
  };
}

type BuildOnePictureOutcome<T extends HasTimeDelta> = [
  { imageSpans: Array<T & TraceSpanSpec>; rest: T[] },
  "Give up, there's no way this is gonna fit" | null
];

function buildOnePicture<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageDescription,
  pictureID: number,
  seededRandom: SeededRandom
): BuildOnePictureOutcome<T> {
  return spaninate("build one picture", (s) => {
    s.setAttribute("app.waterfallImageDescription", JSON.stringify(waterfallImageDescription));
    s.setAttribute("app.pictureID", pictureID);
    const maxIncrement = maxIncrementThatMightStillFit(spans, waterfallImageDescription.rows);
    s.setAttribute("app.maxIncrement", maxIncrement);
    const possibleIncrements = range(0, maxIncrement + 1);
    seededRandom.shuffleInPlace(possibleIncrements);
    const finalFitResult: "fail" | FoundASpot<T> = findResult(possibleIncrements, (incrementFromTheLeft) =>
      findASpot(spans, waterfallImageDescription.rows, incrementFromTheLeft++)
    );

    if (finalFitResult === "fail") {
      s.setAttribute("app.fitResult", "fail");
      // we are done putting images in there
      return [{ imageSpans: [], rest: spans }, "Give up, there's no way this is gonna fit"];
    }

    const { waterfallImageSpans, availableSpans } = finalFitResult;
    s.setAttribute("app.waterfallImageSpanCount", waterfallImageSpans.length);
    // ok. now we have an allocated span for each of the picture rows. The rest of the spans are in availableSpans

    const waterfallImageSpecs3 = determineTreeStructure(waterfallImageSpans) as Array<T & TraceSpanSpec>; // dammit typescript, i have spent too much time fighting you

    waterfallImageSpecs3.forEach((ss, i) => {
      (ss as any)["waterfallImageName"] = waterfallImageDescription.waterfallImageName; // add these fields for tracing
      (ss as any)["waterfallPictureID"] = pictureID;
      (ss as any)["waterfallPosition"] = `Line ${i} in Picture ${pictureID}`;
    });
    return [
      {
        imageSpans: waterfallImageSpecs3,
        rest: availableSpans,
      },
      null,
    ];
  });
}

function maxIncrementThatMightStillFit(spans: HasTimeDelta[], waterfallImageDescription: WaterfallImageRow[]) {
  const minTimeDelta = Math.min(...spans.map((s) => s.time_delta));
  const maxTimeDelta = Math.max(...spans.map((s) => s.time_delta)); // should be 0
  const waterfallImageWidth = Math.max(...waterfallImageDescription.map((w) => w.start + w.width));
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
    throw new Error(`Invalid increment: ${increment}. Waterfall is only ${maxTimeDelta - minTimeDelta} wide`);
  }
  const totalWaterfallWidth = maxTimeDelta - minTimeDelta;
  const waterfallImageWidth = Math.max(...waterfallImageDescription.map((w) => w.start + w.width));
  const waterfallImagePixelWidth = Math.floor((totalWaterfallWidth / waterfallImageWidth) * 0.6);

  return {
    calculateTimeDelta: (start: number) => start * waterfallImagePixelWidth + minTimeDelta + increment,
    calculateWidth: (width: number) => width * waterfallImagePixelWidth,
  };
}

function readImageData(pixels: Pixels): WaterfallImageRow[] {
  function hasSomeBlue(p: Pixel): boolean {
    // exclude white
    return p.color.blue > 0 && p.color.darkness() > 0;
  }

  const rows = range(0, pixels.height).map((y) => {
    const start = range(0, pixels.width).find((x) => hasSomeBlue(pixels.at(x, y)));
    if (start === undefined) {
      return undefined; // filter these out later
    }
    const possibleWidth = range(start, pixels.width).findIndex((x) => !hasSomeBlue(pixels.at(x, y)));
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

function groupByTimeDelta<T extends HasTimeDelta>(ss: T[]): Record<number, T[]> {
  return ss.reduce((p, c) => {
    const k = c.time_delta;
    if (!p.hasOwnProperty(k)) {
      p[k] = [];
    }
    p[k].push(c);
    return p;
  }, {} as Record<number, T[]>);
}

function determineTreeStructure<T extends HasTimeDelta & MightBeASpanEvent>(specsSoFar: T[]) {
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
  const lastRow = waterfallImageSpecs3[findLastIndex(waterfallImageSpecs3, (s) => !s.spanEvent)];
  (lastRow as any)["app.lastRow.popAfter"] = lastRow.popAfter;
  (lastRow as any)["app.lastRow.parentTimeDeltasLength"] = parentTimeDeltas.length;
  lastRow.popAfter = parentTimeDeltas.length;

  return waterfallImageSpecs3;
}

/**
 * https://stackoverflow.com/questions/40929260/find-last-index-of-element-inside-array-by-certain-condition
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}

type FoundASpot<T extends HasTimeDelta> = {
  waterfallImageSpans: Array<T & MightBeASpanEvent>;
  availableSpans: T[];
};
type PossibleFits<T extends HasTimeDelta> = [FoundASpot<T>, null] | [null, "Not enough room"];
// typescript makes this hard... use go-style return
function findASpot<T extends HasTimeDelta>(
  spans: T[],
  waterfallImageDescription: WaterfallImageRow[],
  incrementFromTheLeft: number
): PossibleFits<T> {
  const fitWithinImage = proportion(spans, waterfallImageDescription, incrementFromTheLeft);
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
function reduceUntilStop<T, R>(arr: T[], fn: (prev: R, e: T, i: number) => R | "stop", init: R): R {
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

function mapUntilFail<T, R>(arr: T[], fn: (e: T, i: number) => R | "fail"): R[] | "fail" {
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

function findResult<T, R>(arr: T[], fn: (e: T, i: number) => [R, null] | [null, "Not enough room"]): R | "fail" {
  for (var i = 0; i < arr.length; i++) {
    const [result, err] = fn(arr[i], i);
    if (err !== "Not enough room") {
      return result;
    }
  }
  return "fail";
}
