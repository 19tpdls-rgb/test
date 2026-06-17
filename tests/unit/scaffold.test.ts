import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("scaffold", () => {
  it("merges utility class names", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});
