import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const { DiagConsoleLogger, DiagLogLevel, diag } = require("@opentelemetry/api");
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// The Trace Exporter exports the data to Honeycomb and uses
// the environment variables for endpoint, service name, and API Key.
const traceExporter = new OTLPTraceExporter();

const sdk = new NodeSDK({
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    scheduledDelayMillis: 500,
    maxQueueSize: 16000,
    maxExportBatchSize: 1000,
  }),
});

export { sdk };
