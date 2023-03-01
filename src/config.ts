import { readImage } from "./image";

import { default as rednessJson } from "../input/redkey.json";
import { HeatmapConfig } from "./heatmap";
import { HappyO11ydaysSGConfig, StackedGraphConfig } from "./stackedGraph";
import { HappyO11ydaysConfig, WaterfallConfig } from "./waterfall";

export type InternalConfig = {
  heatmap: HeatmapConfig;
  stackedGraph: StackedGraphConfig;
  waterfall: WaterfallConfig;
};
export function readConfiguration(filename: string): InternalConfig {
  const pixels = readImage(filename);
  return {
    heatmap: { attributesByRedness: rednessJson, pixels },
    stackedGraph: HappyO11ydaysSGConfig,
    waterfall: HappyO11ydaysConfig,
  };
}
