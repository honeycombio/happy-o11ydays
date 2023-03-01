import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs";

const { DiagConsoleLogger, DiagLogLevel, diag } = require("@opentelemetry/api");
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// The Trace Exporter exports the data to Honeycomb and uses
// the environment variables for endpoint, service name, and API Key.
const traceExporter = new OTLPTraceExporter();

const sdk = new NodeSDK({
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    scheduledDelayMillis: 200,
    maxQueueSize: 20000,
    maxExportBatchSize: 1000,
  }),
  instrumentations: [new HttpInstrumentation(), new FsInstrumentation()],
});

export { sdk };
