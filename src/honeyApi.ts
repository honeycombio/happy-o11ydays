import axios from "axios";

import otel from "@opentelemetry/api";

const tracer = otel.trace.getTracer("honeyApi.ts");

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
  return tracer.startActiveSpan("fetch authorization", async (s) => {
    const resp = await axios
      .get<AuthResponse>("https://api.honeycomb.io/1/auth", {
        responseType: "json",
        headers: { "X-Honeycomb-Team": apiKey },
      })
      .catch((e) => e.response);
    if (resp.status !== 200) {
      s.setAttribute("app.responseStatus", resp.status);
      console.log(
        "WARNING: Could not retrieve team/env data from APIKEY. " + resp.status
      );
      return undefined;
    }

    s.end();
    return resp.data;
  });
}

export function fetchConfiguration() {
  return tracer.startActiveSpan("fetch configuration from env", (s) => {
    const apiKey = process.env["HONEYCOMB_API_KEY"];
    if (!apiKey) {
      s.setAttribute("app.warning", "api key not defined");
      console.log(
        "Warning: HONEYCOMB_API_KEY not defined, so I can't give you a link"
      );
    }
    const dataset = process.env["OTEL_SERVICE_NAME"];
    if (!dataset) {
      s.setAttribute("app.warning", "service not defined");
      console.log(
        "Warning: OTEL_SERVICE_NAME not defined, so I can't link you to your dataset"
      );
    }
    s.end();
    return {
      dataset,
      apiKey,
    };
  });
}

export async function findLinkToDataset(
  traceId: string
): Promise<string | undefined> {
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

  //return `https://ui.honeycomb.io/${authData.team.slug}/environments/${authData.environment.slug}${datasetPortion}/trace?trace_id=${traceId}`;
  return `https://ui.honeycomb.io/${authData.team.slug}/environments/${authData.environment.slug}${datasetPortion}`;
}

export async function checkAuthorization() {
  return tracer.startActiveSpan("check authorization", async (s) => {
    const { apiKey } = fetchConfiguration();
    if (apiKey === undefined) {
      const w =
        "hmm, no HONEYCOMB_API_KEY. For full functionality, get one, and run this with './run' it'll set you up better";
      s.setStatus({ code: 1, message: w });
      s.setAttribute("error", true);
      s.setAttribute("app.warning", w);
      s.end();
      return;
    }
    const otlp_endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
    s.setAttribute(
      "app.otel_exporter_otlp_endpoint",
      otlp_endpoint || "default to local collector"
    );
    const authData = await fetchAuthorization(apiKey);
    if (!authData) {
      const e = new Error(
        "Couldn't verify your API key with Honeycomb. Hmm, try pasting your HONEYCOMB_API_KEY into https://honeycomb-whoami.glitch.me to test it"
      );
      s.recordException(e); // you could see it if you also send to jaeger, or something
      s.setStatus({ code: 3, message: e.message });
      s.setAttribute("error", true);
      s.end();
      throw e;
    }
    if (!authData?.api_key_access.createDatasets) {
      const warning =
        "WARNING: No create dataset permission... if this is the only API key you can get, then set OTEL_SERVICE_NAME to an existing dataset.";
      s.setAttribute("app.warning", warning);
      console.log(warning);
    }
    s.end();
    return;
  });
}
