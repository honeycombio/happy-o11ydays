import { spaninate } from "./tracing";

const verseMarker = "🎼";
export class SpanSong {
  private verses: Verse[];
  constructor(private songLyrics: string) {
    this.verses = spaninate("construct span song", (span) => {
      span.setAttribute("app.songLyrics", songLyrics);
      return songLyrics.split(verseMarker).map((l) => new Verse(l));
    });
  }

  public nameThisSpan(): string {
    if (this.verses.length === 0) {
      return randomMusic();
    }
    return this.verses[0].nextLine();
  }

  public nextVerse() {
    this.verses.shift();
  }
}

function randomMusic() {
  const musicCharacters = [..."♪🎶𝄢𝄞🎵♬🎶♩𝄇"];
  const hummingWords = ["doo", "la", "mmm", "dee", "da", "hum", "ooo"];
  function randomCharacter() {
    return musicCharacters[Math.floor(Math.random() * musicCharacters.length)];
  }
  function randomHummingWord() {
    return hummingWords[Math.floor(Math.random() * hummingWords.length)];
  }
  return [
    randomCharacter(),
    randomHummingWord(),
    randomHummingWord(),
    randomHummingWord(),
    randomCharacter(),
  ].join(" ");
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
