import axios from "axios";
import {
  checkAuthorization,
  fetchAuthorization,
  fetchConfiguration,
} from "./honeyApi";
import otel from "@opentelemetry/api";

const tracer = otel.trace.getTracer("dataset.ts");

// This function first gathers a lot of information,
// then creates a dataset with a cute name if appropriate.
export async function initializeDatasetInHoneycomb() {
  return tracer.startActiveSpan(
    "initialize dataset in honeycomb",
    async (s) => {
      const { apiKey, dataset } = fetchConfiguration();
      if (!apiKey) {
        s.setAttribute("app.honeycombApiKey", "undefined");
        s.end();
        return { status: "No Honeycomb API Key" };
      }
      const authCheckResult = await checkAuthorization(apiKey);
      await initializeDataset();
      s.end();
      return authCheckResult; // so far
    }
  );
}

async function initializeDataset() {
  return tracer.startActiveSpan("initialize dataset", async (s) => {
    const { dataset, apiKey } = fetchConfiguration();
    s.setAttribute("app.dataset", dataset || "no dataset defined");
    s.setAttribute("app.apiKeyLength", apiKey?.length || 0);
    if (!apiKey || !dataset) {
      s.setStatus({
        code: 4,
        message: "API or dataset not populated, can't make it cute",
      });
      s.end();
      return;
    }
    const headers = { "X-Honeycomb-Team": apiKey };

    const existingDataset = await axios
      .get(`https://api.honeycomb.io/1/datasets/${dataset}`, {
        headers,
      })
      .catch((e) => e.response);
    s.setAttribute("app.resultStatus", existingDataset.status);
    if (existingDataset.status === 404) {
      const createResult = createDataset(apiKey, dataset);
      s.end();
      return createResult;
    } else if (existingDataset.status === 200) {
      console.log(`Dataset ${dataset} exists, ok`);
    } else {
      console.log(
        "WARNING: Failed to check for dataset: " + existingDataset.status
      );
    }
    s.end();
    return;
  });
}

const HappyO11ydaysDescription =
  "Happy O11ydays from Honeycomb! This dataset brought to you by: github.com/honeycombio/happy-o11ydays";

async function createDataset(apiKey: string, dataset: string) {
  return tracer.startActiveSpan("create dataset", async (s) => {
    const name = dataset === "happy-o11ydays" ? "Happy O11ydays" : dataset;
    const headers = { "X-Honeycomb-Team": apiKey };
    const datasetProperties = {
      name,
      description: HappyO11ydaysDescription,
      slug: dataset,
      expand_json_depth: 0,
    };

    const response = await axios
      .post("https://api.honeycomb.io/1/datasets", datasetProperties, {
        headers,
      })
      .catch((e) => {
        s.setAttribute("error", true);
        s.recordException(e);
        return e.response;
      });
    s.setAttribute("app.responseStatus", response.status);
    if (response.status === 201) {
      console.log(`Dataset ${dataset} created`);
      // great
      s.setAttribute("app.datasetCreated", dataset);
    } else if (response.status === 401) {
      console.log(`Unauthorized on create dataset :-( `);
      const authData = fetchAuthorization(apiKey);
      s.setAttribute("error", true);
      console.log(JSON.stringify(authData, null, 2)); // this must have been useful at some point
    } else {
      console.log(
        "WARNING: Could not create dataset: " + JSON.stringify(response.status)
      );
      s.setAttribute("error", true);
    }
    s.end();
    return;
  });
}
