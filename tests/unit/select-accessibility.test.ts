// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

describe("Select accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("associates the product label with the real select trigger", () => {
    render(
      createElement(
        "div",
        null,
        createElement(Label, { htmlFor: "productId" }, "상품"),
        createElement(
          Select,
          {
            value: "night",
            onValueChange: () => undefined,
            items: [
              { label: "상품을 선택하세요", value: null },
              { label: "PICUP PICNIC NIGHT (NIGHT)", value: "night" },
            ],
          },
          createElement(
            SelectTrigger,
            { id: "productId" },
            createElement(SelectValue, {
              placeholder: "상품을 선택하세요",
            }),
          ),
          createElement(
            SelectContent,
            null,
            createElement(
              SelectGroup,
              null,
              createElement(
                SelectItem,
                { value: null },
                "상품을 선택하세요",
              ),
              createElement(
                SelectItem,
                { value: "night" },
                "PICUP PICNIC NIGHT (NIGHT)",
              ),
            ),
          ),
        ),
      ),
    );

    const trigger = screen.getByLabelText("상품");

    expect(trigger).toBeInstanceOf(HTMLElement);
    expect(trigger.hasAttribute("hidden")).toBe(false);
    expect(trigger.getAttribute("aria-hidden")).not.toBe("true");
    expect(trigger.textContent).toContain("PICUP PICNIC NIGHT (NIGHT)");
  });
});
