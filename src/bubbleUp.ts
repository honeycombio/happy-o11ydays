import { Pixel } from "./image";

import { default as rednessJson } from "./redkey.json";

const rednessKey: Record<string, object> = rednessJson;

export function populateAttributes(p: Pixel): object {
  const result = rednessKey[p.color.red] || {};
  // console.log(
  //   "For pixel with redness " +
  //     p.color.red +
  //     ", reporting properties " +
  //     JSON.stringify(result)
  // );
  return result;
}

function test() {
  console.log("Test of reading json");

  console.log("Full redness key: " + JSON.stringify(rednessKey));

  console.log("Redness of 90: " + JSON.stringify(rednessKey[90]));

  console.log("Redness of '90': " + JSON.stringify(rednessKey["90"]));
}
// test(); // uncomment this and run as main, to run only the test
