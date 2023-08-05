import { sdk } from "./initialize-tracing";

import otel, { Context, Span } from "@opentelemetry/api";
import { convertPixelsToWhatItsGonnaLookLike } from "./convertToHeatmap";
import { spaninate } from "./tracing";
import { InternalConfig, readConfiguration } from "./config";

const greeting = (text: string) => ` _________________ 
< ${text}! >
 ----------------- 
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;

async function main(rootContext: Context, imageFile: string) {
  const config = readConfiguration(imageFile);

  spaninate("greet", () => console.log(greeting(config.greeting)));

  spaninate("convert image", () => convertImage(config));
}

function convertImage(config: InternalConfig) {
  spaninate("convert pixels to spans", () =>
    convertPixelsToWhatItsGonnaLookLike(config.heatmap.pixels)
  );
}

const tracer = otel.trace.getTracer("main.ts");

const imageFile = process.argv[2] || "input/happyO11ydays.json";
const rootContext = otel.context.active();
sdk
  .start()
  .then(() =>
    tracer.startActiveSpan("main", (s) =>
      main(rootContext, imageFile).then(
        () => {
          s.end();
        },
        (e) => {
          s.recordException(e);
          s.end();
          console.log(e); // do catch it, so that the sdk will shutdown and we will get the whole trace
        }
      )
    )
  )
  .then(() => sdk.shutdown());
