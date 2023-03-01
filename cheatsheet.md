# What are we doing here?

I have a program, a script that I wrote for fun for Christmastime,
and I want to make it better. I want it more general, not just for Christmas.

To do that, I need to refactor it to accept all configuration up front,
instead of reading hard-coded filenames throughout its work.

There's no tests. So how can I refactor safely?
I can manually test each time I make a tiny change, but that's boring
because "yeah, no change detected" is BORING.

I could write tests for parts of it, but it's a visual thing, and it
uses randomness, and it uses time, so before I could write tests,
I'd have to do a bunch of refactoring.
Now we're back where we started.

So let's try something different. Let's add tracing to the program
-- that makes it more maintainable anyway --
and let's watch the traces change as we do some refactoring.

Adding traces will help us figure out how it works, and it'll make the refactoring visible.

The plan for today is to dig around adding traces for forty minutes or whatever,
and in the last ten minutes I want to show you the really cute stuff that the program does.
In the meantime, I'm going to use a local Jaeger instance to see the traces.

OK. This program has OpenTelemetry configured already, for reasons that will become clear.
Because it's a script, not something long-running like a webserver, I need to wait for the SDK to start up
and then wait for it to shut down. ...

## add span around main

```
sdk
  .start()
  .then(() =>
    tracer.startActiveSpan("main", (s) =>
      main(rootContext, imageFile).then(
        () => s.end(),
        (e) => {
          s.recordException(e);
          s.end();
        }
      )
    )
  )
  .then(() => sdk.shutdown());
```

now we have a main span. What can we get out of automatic instr?

## find nonlocal imports

```
grep import src/*.ts | grep -v '"\.'
```

## bring in http instrumentation

```
npm i @opentelemetry/instrumentation-http
```

in src/initialize-tracing.ts:

```
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
//stuff
  instrumentations: [new HttpInstrumentation()],
```

## bring in fs instrumentation

```
npm i @opentelemetry/instrumentation-fs
```

in src/initialize-tracing.ts:

```
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs";
//stuff
  instrumentations: [new FsInstrumentation()],
```

Look at all those fs access! But we can't tell what files! let's wrap them in a span where we can.
Search the project for readFileSync

## span in readPng

```
import otel from "@opentelemetry/api";

const tracer = otel.trace.getTracer("image.ts");

function readPng(location: string): PNGWithMetadata {
  return tracer.startActiveSpan("read PNG", (s) => {
    s.setAttribute("app.file", location);
    var data = fs.readFileSync(location);
    const result = PNG.sync.read(data);
    s.end();
    return result;
  });
}
```

OK. From here we go either from the top or work our way up, adding spans.

Things that get hard:

- adding a span around a constructor, in SpanSong, which reads a file
- adding a span in buildOnePicture, because the types are painful

## span in buildOnePicture

````
  return tracer.startActiveSpan<(span: Span) => BuildOnePictureOutcome<T>>("build one picture", (s) => {
    // body of function
    s.end();
    // return
    });
    ```
````

## adding a span link to the produced trace

First, make sendSpans return the whole spanContext, not just the traceId.
Then, using that createdSpanContext:

```
  otel.trace.getActiveSpan()?.setAttribute("app.constructedTraceId", traceId);
  tracer.startSpan("here is the link", {links: [
    {
       context: createdSpanContext
    }
  ]}).end();
```
