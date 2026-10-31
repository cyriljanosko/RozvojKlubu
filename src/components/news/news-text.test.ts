import { describe, expect, it } from "vitest";

import { splitLinks } from "./news-text";

describe("splitLinks – links in the text of a post", () => {
  it("keeps plain text as it is", () => {
    expect(splitLinks("Prihláste svojich trénerov.")).toEqual([
      { text: "Prihláste svojich trénerov." },
    ]);
  });

  it("turns [label](url) into a link with the label", () => {
    expect(
      splitLinks(
        "Viac na webe SFZ: [Školenie UEFA A](https://futbalsfz.sk/treneri/skolenia/uefa-a/).",
      ),
    ).toEqual([
      { text: "Viac na webe SFZ: " },
      { text: "Školenie UEFA A", href: "https://futbalsfz.sk/treneri/skolenia/uefa-a/" },
      { text: "." },
    ]);
  });

  it("links a bare address without the trailing punctuation", () => {
    expect(splitLinks("Prihlášky: https://futbalsfz.sk/treneri/skolenia/uefa-a.")).toEqual([
      { text: "Prihlášky: " },
      {
        text: "https://futbalsfz.sk/treneri/skolenia/uefa-a",
        href: "https://futbalsfz.sk/treneri/skolenia/uefa-a",
      },
      { text: "." },
    ]);
  });

  it("does not link other schemes", () => {
    expect(splitLinks("[klik](javascript:alert(1)) a mailto:a@b.sk")).toEqual([
      { text: "[klik](javascript:alert(1)) a mailto:a@b.sk" },
    ]);
  });
});
