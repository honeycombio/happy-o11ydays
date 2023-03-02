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
const tracer = otel.trace.getTracer("main");


sdk
  .start()
  .then(() =>
    tracer.startActiveSpan("main", (s) =>
      main(rootContext, imageFile).then(
        () => {
          printLinkToTrace(s);
          s.end();
        },
        (e) => {
          s.recordException(e);
          s.end();
          printLinkToTrace(s);
          console.log(e);
        }
      )
    )
  )
  .then(() => sdk.shutdown());
```

... and then add the link to trace ('link' snippet)
... then add a field

```
  otel.trace.getActiveSpan()?.setAttribute("app.imageFile", imageFile);
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

Go look at a trace. See the multiple calls to auth

## find where the two calls to /1/auth are

At the top level, let's explain this program to ourselves

```
  spaninateAsync("check auth", () => checkAuthorization());
  spaninateAsync("init dataset", initializeDataset);

  spaninate("greet", () => console.log(greeting));

  const pixels = spaninate("read image", () => readImage(imageFile));

  const spanSpecs = spaninate("plan spans", () => planSpans(pixels));

  const sentSpanContext = spaninate("send spans", () => sendSpans(rootContext, spanSpecs));

  const url = await spaninateAsync("find link", () => findLinkToDataset(sentSpanContext.traceId));
  console.log("  Oh look, I drew a picture: " + url + "\n");
```

looking at the trace, I can learn:
I forgot to say "await" at the beginning, on those first two.
Not currently sure why those are synchronous now, but my goal is not
to change that.
Traces let me see when I've changed the concurrency model of the program!

(now go add 'await' in front of spaninateAsync)

## change the flow and see a difference

make findLink accept authData instead of fetching it;
make main pass it in, and get it from fetchAuth;
make fetchAuth return it.

Now run it and see how the trace is different.
In Honeycomb, we can count the calls to HTTPS GET.

So we made a refactor, with a performance impact, and we can see that
impact. We can put these before/after traces in a pull request.
In this case, we can kinda see a perf improvement locally, but I'd expect to see that for real in production.

## bring in fs instrumentation

Now back toward the objective, of making this program configurable. I know it reads in hard-coded files from the file system, like pictures of ornaments and trees. Let's find those.

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
function readPng(filename: string): PNGWithMetadata {
  return spaninate("read png", (s) => {
    s.setAttribute("app.filename", filename);
    var data = fs.readFileSync(filename);
    return PNG.sync.read(data);
  });
}
```

Look at a trace, see allll the file reads.

How many times _is_ it reading these files? ... do a count.
get a graph of a count of spans by app.filename, where app.filename exists

I'm not gonna implement the move-left on this live, it's more typing,
you've seen the idea with authData.

## span for fetchNow

To make it testable, I also want to find the other places where the program interacts with the world.

Like date.now, where is that called?
I'm going to put a span around that, so I can move it left too.

````
export function fetchNow() {
  return spaninate("fetch now", () => {
    return Math.ceil(Date.now() / 1000);
  });
}
```

## now cheat and jump to "after"

checkout after, run-local
go back to graph of counts, notice that the filename now includes the full path
and now there is only one access of each

maybe make a heatmap of duration
it doesn't look like much
remove condition, see... something

then go to board to see the heatmap(height)
see the cute art

then run it with spotcon config
see the spotcon logo

click to see that trace, the poem about the birds
Notice that there is a bug, some of the verses are inside each other.

Talk about how surprises happen in production, you can't test every possibility, and you shouldn't.
Fix what does happen.
And I can, because my traces are there for me.
Click into the 'main' trace (there's a link at the root span of the pretty trace)
and notice that "read configuration" shows you the config contents.
That "decide how many pixels to send per color" shows you the blueness density function.

What I need to troubleshoot this is here, or I will add it. It is my job
as a developer to make this code teach me what I need to know in order to change that.

Because when i have that - when I can change it comfortably - it is no longer legacy.

My definition of legacy code is: code that isn't alive in a team's heads.
Code that isn't part of a symmathesy, a learning system made of learning parts, where some of those parts are us.

So teach the code how to teach you how to teach it new tricks...
yes it's a big spiral into the future.





````
