import axios from "axios";

type AuthResponse = {
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

export async function findLinkToDataset(): Promise<string | undefined> {
  const apiKey = process.env["HONEYCOMB_API_KEY"];
  if (!apiKey) {
    console.log(
      "Warning: HONEYCOMB_API_KEY not defined, so I can't give you a link"
    );
    return undefined;
  }
  const dataset = process.env["OTEL_SERVICE_NAME"];
  if (!dataset) {
    console.log(
      "Warning: OTEL_SERVICE_NAME not defined, so I can't link you to your dataset"
    );
  }
  try {
    const resp = await axios.get<AuthResponse>(
      "https://api.honeycomb.io/1/auth",
      { responseType: "json", headers: { "X-Honeycomb-Team": apiKey } }
    );

    const authData = resp.data;
    const datasetPortion = dataset ? `/datasets/${dataset}` : "";

    return `https://ui.honeycomb.io/${authData.team.slug}/environments/lizard${datasetPortion}`;
  } catch (e) {
    console.log("Warning: couldn't retrieve honeycomb auth info.");
    console.error(e);
  }
}
