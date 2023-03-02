import { readImage } from "./image";

import { default as rednessJson } from "../input/redkey.json";
import { HeatmapConfig, SecondsSinceEpoch } from "./heatmap";
import { StackedGraphConfig } from "./stackedGraph";
import { WaterfallConfig } from "./waterfall";
import { spaninate } from "./tracing";
import fs from "fs";
import path from "path";
import { fetchNow, SendConfig } from "./transmit";

export type ExternalConfig = {
  heatmap: {
    imageFile: string;
    blueChannelToDensity?: Record<string, number>;
  };
  waterfall: {
    waterfallImages: { filename: string; maxCount: number }[];
    song: { lyricsFile: string };
  };
  stackedGraph: {
    imageFile: string;
  };
  transmit?: {
    now: SecondsSinceEpoch;
  };
};

export type InternalConfig = {
  heatmap: HeatmapConfig;
  stackedGraph: StackedGraphConfig;
  waterfall: WaterfallConfig;
  transmit: SendConfig;
};
export function readConfiguration(filename: string): InternalConfig {
  return spaninate("read configuration", (s) => {
    s.setAttribute("app.configFile", filename);
    const configContent = readJson(filename) as ExternalConfig;
    s.setAttribute("app.configContent", JSON.stringify(configContent));
    const configDir = path.dirname(filename);
    s.setAttribute("app.configDir", configDir);
    const relativeToConfig = (f: string) => path.resolve(configDir, f);

    // heatmap
    const heatmapImageFile = relativeToConfig(configContent.heatmap.imageFile);
    s.setAttribute("app.heatmapImageFile", heatmapImageFile);
    const pixels = readImage(heatmapImageFile);
    const bluenessToEventDensity = keysToNumbers(
      configContent.heatmap.blueChannelToDensity
    );

    // stacked graph
    const stackedGraphFile = relativeToConfig(
      configContent.stackedGraph.imageFile
    );
    s.setAttribute("app.stackedGraphImageFile", stackedGraphFile);
    const stackedGraphPixels = readImage(stackedGraphFile);

    // waterfall
    const waterfallImages = configContent.waterfall.waterfallImages.map(
      (w) => ({
        maxCount: w.maxCount,
        pixels: readImage(relativeToConfig(w.filename)),
        waterfallImageName: w.filename,
      })
    );

    const songLyrics = readText(
      relativeToConfig(configContent.waterfall.song.lyricsFile)
    );

    const now = configContent.transmit?.now || fetchNow();
    s.setAttribute("app.configuredNow", configContent.transmit?.now || "none");
    s.setAttribute("app.now", now);

    return {
      heatmap: {
        attributesByRedness: rednessJson,
        bluenessToEventDensity,
        pixels,
      },
      stackedGraph: { pixels: stackedGraphPixels },
      waterfall: { waterfallImages, song: { songLyrics } },
      transmit: { now },
    };
  });
}

function readJson(filename: string) {
  return spaninate("read json", (s) => {
    s.setAttribute("app.filename", filename);
    const data = fs.readFileSync(filename, { encoding: "utf8" });
    s.setAttribute("app.fileContent", data);
    return JSON.parse(data);
  });
}

function readText(filename: string) {
  return spaninate("read text", (s) => {
    s.setAttribute("app.filename", filename);
    const data = fs.readFileSync(filename, { encoding: "utf8" });
    return data;
  });
}
function keysToNumbers(
  input: Record<string, number> | undefined
): Record<number, number> | undefined {
  if (input) {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [parseInt(k), v])
    );
  } else return undefined;
}
