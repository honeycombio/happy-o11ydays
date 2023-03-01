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

export async function fetchAuthorization(
  apiKey: string
): Promise<AuthResponse | undefined> {
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

export async function findLinkToDataset(
  authData: AuthResponse,
  traceId: string
): Promise<string | undefined> {
  const { dataset, apiKey } = fetchConfiguration();
  if (!apiKey) {
    return undefined;
  }

  const datasetPortion = dataset ? `/datasets/${dataset}` : "";

  //return `https://ui.honeycomb.io/${authData.team.slug}/environments/${authData.environment.slug}${datasetPortion}/trace?trace_id=${traceId}`;
  return `https://ui.honeycomb.io/${authData.team.slug}/environments/${authData.environment.slug}${datasetPortion}`;
}

export async function checkAuthorization() {
  const { apiKey } = fetchConfiguration();
  if (apiKey === undefined) {
    throw new Error(
      "hmm, no HONEYCOMB_API_KEY. If you run this with './run' it'll set you up better"
    );
  }
  const authData = await fetchAuthorization(apiKey);
  if (!authData) {
    throw new Error(
      "Couldn't verify your API key with Honeycomb. Hmm, try pasting your HONEYCOMB_API_KEY into https://honeycomb-whoami.glitch.me to test it"
    );
  }
  if (!authData?.api_key_access.createDatasets) {
    console.log(
      "WARNING: No create dataset permission... if this is the only API key you can get, then set OTEL_SERVICE_NAME to an existing dataset."
    );
  }
  return authData;
}
