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

export function spaninateAsync<R>(name: string, cb: () => Promise<R>): Promise<R> {
  return tracer.startActiveSpan(name,async (s) => {
    try {
      return await cb();
    } catch (e) {
      s.recordException(e as Error);
      throw e;
    } finally {
      s.end();
    }
  });
}
