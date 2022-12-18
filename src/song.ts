import fs from "fs";
export class SpanSong {
  private lines: string[];
  constructor(private filename: string) {
    const data = fs.readFileSync(filename, { encoding: "utf8" });
    this.lines = data.split("\n");
  }

  public nameThisSpan(): string {
    const next = this.lines.pop();
    return next || "la la la la la 🎶";
  }
}
