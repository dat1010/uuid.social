import { describe, expect, it } from "vitest";

import { parseRecordText } from "./record-text";

describe("record link parsing", () => {
  it("linkifies http, https, and www addresses", () => {
    expect(parseRecordText("See https://example.com and www.example.org/path")).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: " and " },
      { type: "link", value: "www.example.org/path", href: "https://www.example.org/path" },
    ]);
  });

  it("keeps sentence punctuation outside the link", () => {
    expect(parseRecordText("Try https://example.com/test, seriously.")).toEqual([
      { type: "text", value: "Try " },
      { type: "link", value: "https://example.com/test", href: "https://example.com/test" },
      { type: "text", value: "," },
      { type: "text", value: " seriously." },
    ]);
  });

  it("does not treat non-web protocols or markup as links", () => {
    expect(parseRecordText("javascript:alert(1) <script>nope</script>"))
      .toEqual([{ type: "text", value: "javascript:alert(1) <script>nope</script>" }]);
  });
});
