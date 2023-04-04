import otel, { Span } from "@opentelemetry/api";
import ErrorStackParser from "error-stack-parser";

const tracer = otel.trace.getTracer("not the art, but the artist");

export function spaninate<R>(name: string, cb: (s: Span) => R): R {
  const stack = ErrorStackParser.parse(new Error("BOOM"));
  const where = stack[1];
  return tracer.startActiveSpan(name, (s) => {
    try {
      if (where) {
        s.setAttribute("debug.file", where.fileName || "");
        s.setAttribute("debug.line", where.lineNumber || 0);
        s.setAttribute("debug.function", where.functionName || "");
      }
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
