import fs from "fs";

const verseMarker = "🎼";
export class SpanSong {
  private verses: Verse[];
  constructor(private filename: string) {
    const data = fs.readFileSync(filename, { encoding: "utf8" });
    this.verses = data.split(verseMarker).map((l) => new Verse(l));
  }

  public nameThisSpan(): string {
    if (this.verses.length === 0) {
      return "🎵 doodeedoodoo ♬";
    }
    return this.verses[0].nextLine();
  }

  public nextVerse() {
    this.verses.shift();
  }
}

class Verse {
  private lines: string[];
  constructor(data: string) {
    this.lines = data.split("\n");
  }

  nextLine() {
    const text = this.lines.shift();
    return text || "🎶";
  }
}
