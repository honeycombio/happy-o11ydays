import axios from "axios";
import { fetchAuthorization, fetchConfiguration } from "./honeyApi";

export async function initializeDataset() {
  const { dataset, apiKey } = fetchConfiguration();
  if (!apiKey || !dataset) {
    return;
  }
  const headers = { "X-Honeycomb-Team": apiKey };

  const existingDataset = await axios
    .get(`https://api.honeycomb.io/1/datasets/${dataset}`, {
      headers,
    })
    .catch((e) => e.response);
  if (existingDataset.status === 404) {
    return createDataset(apiKey, dataset);
  } else if (existingDataset.status === 200) {
    // console.log(`Dataset ${dataset} exists, ok`);
  } else {
    console.log(
      "WARNING: Failed to check for dataset: " + existingDataset.status
    );
  }
}

const HappyO11ydaysDescription =
  "Happy O11ydays from Honeycomb! This dataset brought to you by: github.com/honeycombio/happy-o11ydays";

async function createDataset(apiKey: string, dataset: string) {
  const name = dataset === "happy-o11ydays" ? "Happy O11ydays" : dataset;
  const headers = { "X-Honeycomb-Team": apiKey };
  const datasetProperties = {
    name,
    description: HappyO11ydaysDescription,
    slug: dataset,
    expand_json_depth: 0,
  };

  const response = await axios
    .post("https://api.honeycomb.io/1/datasets", datasetProperties, { headers })
    .catch((e) => {
      return e.response;
    });
  if (response.status === 201) {
    console.log(`Dataset ${dataset} created`);
    // great
  } else if (response.status === 401) {
    console.log(`Unauthorized on create dataset :-( `);
    const authData = fetchAuthorization(apiKey);
    console.log(JSON.stringify(authData, null, 2));
  } else {
    console.log(
      "WARNING: Could not create dataset: " + JSON.stringify(response.status)
    );
  }
}
