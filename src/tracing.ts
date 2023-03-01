import otel from "@opentelemetry/api";

const tracer = otel.trace.getTracer("paint-by-trace");

export function spaninate<R>(name: string, cb: () => R): R {
  return tracer.startActiveSpan(name, (s) => {
    try {
      return cb();
    } catch (e) {
      s.recordException(e as Error);
      throw e;
    } finally {
      s.end();
    }
  });
}


