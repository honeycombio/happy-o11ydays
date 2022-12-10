import axios from "axios";

export type AuthResponse = {
  api_key_access: {
    events: boolean;
    markers: boolean;
    triggers: boolean;
    boards: boolean;
    queries: boolean;
    columns: boolean;
    createDatasets: boolean;
  };
  environment: {
    name: string;
    slug: string;
  };
  team: {
    name: string;
    slug: string;
  };
};

export async function fetchAuthorization(apiKey: string) {
  const resp = await axios
    .get<AuthResponse>("https://api.honeycomb.io/1/auth", {
      responseType: "json",
      headers: { "X-Honeycomb-Team": apiKey },
    })
    .catch((e) => e.response);
  if (resp.status !== 200) {
    console.log(
      "WARNING: Could not retrieve team/env data from APIKEY. " + resp.status
    );
    return undefined;
  }

  return resp.data;
}

export function fetchConfiguration() {
  const apiKey = process.env["HONEYCOMB_API_KEY"];
  if (!apiKey) {
    console.log(
      "Warning: HONEYCOMB_API_KEY not defined, so I can't give you a link"
    );
  }
  const dataset = process.env["OTEL_SERVICE_NAME"];
  if (!dataset) {
    console.log(
      "Warning: OTEL_SERVICE_NAME not defined, so I can't link you to your dataset"
    );
  }
  return {
    dataset,
    apiKey,
  };
}

export async function findLinkToDataset(): Promise<string | undefined> {
  const { dataset, apiKey } = fetchConfiguration();
  if (!apiKey) {
    return undefined;
  }

  const authData = await fetchAuthorization(apiKey);
  if (authData === undefined) {
    console.log("Warning: couldn't retrieve honeycomb auth info.");
    return undefined;
  }
  const datasetPortion = dataset ? `/datasets/${dataset}` : "";

  return `https://ui.honeycomb.io/${authData.team.slug}/environments/${authData.environment.slug}/${datasetPortion}`;
}
