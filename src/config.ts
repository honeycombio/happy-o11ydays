import { readImage } from "./image";

import { default as rednessJson } from "../input/redkey.json";
import { HeatmapConfig } from "./heatmap";
import { StackedGraphConfig } from "./stackedGraph";
import { WaterfallConfig } from "./waterfall";
import { spaninate } from "./tracing";

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

export type InternalConfig = {
  heatmap: HeatmapConfig;
  stackedGraph: StackedGraphConfig;
  waterfall: WaterfallConfig;
};
export function readConfiguration(filename: string): InternalConfig {
  return spaninate("read configuration", (s) => {
    s.setAttribute("app.configFile", filename);
    const pixels = readImage(filename);
    return {
      heatmap: { attributesByRedness: rednessJson, pixels },
      stackedGraph: HappyO11ydaysSGConfig,
      waterfall: HappyO11ydaysConfig,
    };
  });
}
