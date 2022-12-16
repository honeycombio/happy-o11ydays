import { readImage } from "./image";

export type FractionOfGranularity = number;
export type TraceSpanSpec = { increment: number, duration: FractionOfGranularity }
export function addTraceArtSpecs<T extends { time_delta: number }>(
  graphSpanSpecs: T[]
): Array<T & TraceSpanSpec> {
  class IncrementMarker {
    private previous_time_delta: number = -500000; // nonsense
    private increment: number = 0;
    public mark: (ss: T) => T & TraceSpanSpec = (ss: T) => {
      if (ss.time_delta !== this.previous_time_delta) {
        // reset
        this.previous_time_delta = ss.time_delta;
        this.increment = 0;
      }
      return { ...ss, increment: this.increment++, duration: 1 / this.increment };
    }
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
