import { Pixel } from "./image";

export type AttributesByRedness = Record<string, object>
export function populateAttributes(attributesByRedness: AttributesByRedness, p: Pixel): object {
  const result = attributesByRedness[p.color.red] || {};
  return result;
}
