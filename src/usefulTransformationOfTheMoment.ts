import { readImage, Color } from "./image";

const bluePixels = readImage("./dontpeek.png");
const redPixels = readImage("./red.png");

// for every populated blue pixel, add as much red as the redPixels have at the same point
bluePixels.all().forEach((p) => {
  if (p.color.darkness() > 0) {
    const howRed = redPixels.at(p.location.x, p.location.y).color.red;
    bluePixels.overwrite(p.withColor(new Color(howRed, 0, p.color.blue, 255)));
  }
});

bluePixels.writeToFile("output.png");
