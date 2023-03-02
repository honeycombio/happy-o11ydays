import { readImage } from "./image";

import { default as rednessJson } from "../input/redkey.json";
import { HeatmapConfig } from "./heatmap";
import { StackedGraphConfig } from "./stackedGraph";
import { WaterfallConfig } from "./waterfall";
import { spaninate } from "./tracing";
import fs from "fs";
import path from "path";

export const HappyO11ydaysConfig: WaterfallConfig = {
  waterfallImages: [
    { filename: "input/bigger-tree.png", maxCount: 10 },
    { filename: "input/tiny-tree.png", maxCount: 1 },
    { filename: "input/bee.png", maxCount: 1 },
    { filename: "input/ornament.png", maxCount: 20 },
  ],
  song: {
    lyricsFile: "input/song.txt",
  },
};

export const HappyO11ydaysSGConfig = {
  imageFilename: "input/house.png",
};

export type ExternalConfig = {
  heatmap: {
    imageFile: string;
    blueChannelToDensity?: Record<string, number>;
  };
};

export type InternalConfig = {
  heatmap: HeatmapConfig;
  stackedGraph: StackedGraphConfig;
  waterfall: WaterfallConfig;
};
export function readConfiguration(filename: string): InternalConfig {
  return spaninate("read configuration", (s) => {
    s.setAttribute("app.configFile", filename);
    const configContent = readJson(filename) as ExternalConfig;
    s.setAttribute("app.configContent", JSON.stringify(configContent));
    const configDir = path.dirname(filename);
    s.setAttribute("app.configDir", configDir);
    const heatmapImageFile = path.resolve(
      configDir,
      configContent.heatmap.imageFile
    );
    s.setAttribute("app.heatmapImageFile", heatmapImageFile);

    const pixels = readImage(heatmapImageFile);
    const bluenessToEventDensity = keysToNumbers(
      configContent.heatmap.blueChannelToDensity
    );

    return {
      heatmap: {
        attributesByRedness: rednessJson,
        bluenessToEventDensity,
        pixels,
      },
      stackedGraph: HappyO11ydaysSGConfig,
      waterfall: HappyO11ydaysConfig,
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
function keysToNumbers(
  input: Record<string, number> | undefined
): Record<number, number> | undefined {
  if (input) {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [parseInt(k), v])
    );
  } else return undefined;
}
