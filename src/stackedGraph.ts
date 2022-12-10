import { Pixel, readImage } from "./image";
import { default as stackKey } from "./stackKey.json";

function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index;
}

function objectMap<V, V2>(
  obj: Record<string, V>,
  fn: (v: V) => V2
): Record<string, V2> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}

function readSpecsFromImage(filename: string) {
  const pixels = readImage(filename);
  const visible = pixels.all().filter((p) => p.color.darkness() > 0);

  // give me the top height of each color, in each column
  type XLoc = number;
  type ColorKey = string;
  type YLoc = number;
  type ColorsbyColumn = Record<XLoc, Record<ColorKey, YLoc>>;
  const distanceFromBottom = function (p: Pixel) {
    return pixels.height - p.location.y;
  };
  const colorsByColumn = visible.reduce((cbc, p) => {
    const colorKey = p.color.toString();
    if (!cbc[p.location.x]) {
      // initialize
      cbc[p.location.x] = {};
    }
    if (!cbc[p.location.x][colorKey]) {
      // initialize
      cbc[p.location.x][colorKey] = 0;
    }
    if (cbc[p.location.x][colorKey] < distanceFromBottom(p)) {
      // compare
      cbc[p.location.x][colorKey] = distanceFromBottom(p);
    }
    return cbc;
  }, {} as ColorsbyColumn);

  // we want only the DIFFERENCE in height between colors, to make a stacked graph.
  // this also gives us the colors and heights in order, bottom to top. That's important.
  const colorAndHeightByColumn: Record<
    XLoc,
    Array<[ColorKey, YLoc]>
  > = objectMap(colorsByColumn, (heightByColor) => {
    const pairs: Array<[ColorKey, YLoc]> = Object.entries(heightByColor);
    const ascendingHeight = pairs.sort((a, b) => a[1] - b[1]);
    for (var i = ascendingHeight.length - 1; i > 0; i--) {
      const heightOfThisColor = ascendingHeight[i][1];
      const heightOfNextColorDown = ascendingHeight[i - 1][1];
      const heightOfThisColorInAStackedGraph =
        heightOfThisColor - heightOfNextColorDown;
      ascendingHeight[i][1] = heightOfThisColorInAStackedGraph;
    }
    return ascendingHeight;
  });

  // which colors need to be on the bottom? We need an ordering
  const colorsInOrderPerColumn: ColorKey[][] = Object.values(
    colorAndHeightByColumn
  ).map((chs) => chs.map(([color, _height]) => color));
  const orderOfColors: ColorKey[] = determineOrdering(colorsInOrderPerColumn);
  function stackSort(color: ColorKey) {
    return orderOfColors.indexOf(color);
  }

  // Now put them in the format to be combined with SpanSpecs
  const distanceFromRight = function (x: XLoc) {
    return x - pixels.width;
  };

  function stackGroup(colorKey: ColorKey) {
    const name =
      stackKey.find((sk) => sk.colorKey === colorKey)?.stackGroup ||
      "something";
    const ordering = orderOfColors.indexOf(colorKey);
    return `${ordering.toString(36)} + ${name}`;
  }

  const specs = Object.entries(colorAndHeightByColumn)
    .map(([x, colorsAndHeights]) =>
      colorsAndHeights.map(([colorKey, y]) => ({ x, y, colorKey }))
    )
    .flat()
    .map((s) => ({
      // this is the klugey bit, make its format match the spanSpec we have
      // (no really, the rest of this program is CLEVER)
      time_delta: distanceFromRight(parseInt(s.x)),
      stackHeight: s.y,
      stackGroup: stackGroup(s.colorKey),
    }));

  return specs;
}

function groupByTimeDelta<T extends EnoughOfASpanSpec>(
  ss: T[]
): Record<string, T[]> {
  return ss.reduce((p, c) => {
    const k = "" + c.time_delta;
    if (!p.hasOwnProperty(k)) {
      p[k] = [];
    }
    p[k].push(c);
    return p;
  }, {} as Record<string, T[]>);
}

type EnoughOfASpanSpec = { time_delta: number };
type PossibleStackSpec = { stackHeight?: number; stackGroup?: string };
export function addStackedGraphAttributes<T extends EnoughOfASpanSpec>(
  spanSpecs: T[]
): Array<T & PossibleStackSpec> {
  var stackSpecCountByDelta = groupByTimeDelta(readSpecsFromImage("house.png")); // the array reference won't be mutated but its contents will be

  const withStackSpecs = spanSpecs.map((ss) => {
    // do we have a need for a stack spec at this time?
    const stackSpecForThisTime = stackSpecCountByDelta[ss.time_delta]?.pop();
    if (stackSpecForThisTime) {
      return { ...ss, ...stackSpecForThisTime };
    } else {
      return ss;
    }
  });

  // warn if we missed any
  Object.values(stackSpecCountByDelta)
    .filter((ss) => ss.length > 0)
    .forEach((missedSpecs) => {
      console.log(
        `WARNING: ${missedSpecs.length} stack spec at ${
          missedSpecs[0].time_delta
        } unused. You'll be missing a ${missedSpecs
          .map((ss) => ss.stackGroup)
          .join(" and a ")}`
      );
    });
  return withStackSpecs;
}

// given lists of colors in each column (in order from bottom to top), return a single list of colors in order.
function determineOrdering<T>(knownOrderings: T[][]): T[] {
  var orderingsToLookAt = knownOrderings;
  var remainingColors = orderingsToLookAt.flat().filter(onlyUnique);
  var bottomToTop = [];

  const onlyExistsAtGroundLevel = (orderings: T[][]) => (v: T) =>
    Math.max(...orderings.map((o) => o.lastIndexOf(v))) === 0;

  while (remainingColors.length > 0) {
    // find the bottom ones
    const bottomColors = remainingColors.filter(
      onlyExistsAtGroundLevel(orderingsToLookAt)
    );
    if (bottomColors.length === 0) {
      console.log("Colors remaining: " + JSON.stringify(remainingColors));
      console.log("Orderings: " + JSON.stringify(orderingsToLookAt));
      throw new Error(
        "Oh no, can't find any colors that exist only on the bottom, infinite loop"
      );
    }
    // put them next in the ordering
    bottomToTop.push(...bottomColors);
    // remove them from the input
    orderingsToLookAt = orderingsToLookAt.map((o) =>
      o.filter((v) => !bottomColors.includes(v))
    );
    var remainingColors = orderingsToLookAt.flat().filter(onlyUnique);
  }
  // this is useful for creating a key
  console.log(
    JSON.stringify(
      bottomToTop.map((c) => ({ colorKey: c, stackGroup: "" })),
      null,
      2
    )
  );

  return bottomToTop;
}
