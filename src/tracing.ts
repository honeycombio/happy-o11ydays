import otel, { Span } from "@opentelemetry/api";

const tracer = otel.trace.getTracer("not the art, but the artist");

export function spaninate<R>(name: string, cb: (s: Span) => R): R {
  return tracer.startActiveSpan(name, (s) => {
    try {
      return cb(s);
    } catch (e) {
      s.recordException(e as Error);
      throw e;
    } finally {
      s.end();
    }
  });
}

export function spaninateAsync<R>(
  name: string,
  cb: (s: Span) => Promise<R>
): Promise<R> {
  return tracer.startActiveSpan(name, async (s) => {
    try {
      return await cb(s);
    } catch (e) {
      s.recordException(e as Error);
      throw e;
    } finally {
      s.end();
    }
  });
}
