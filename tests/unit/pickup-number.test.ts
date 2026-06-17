import { describe, expect, it } from "vitest";

import { getNextPickupNumberFromLists } from "@/lib/reservations/pickup-number";

describe("getNextPickupNumberFromLists", () => {
  it("returns the lowest available pickup number from candidates sorted by sort_order then number", () => {
    const candidates = [
      { id: "pickup-9", number: 9, sort_order: 2 },
      { id: "pickup-3", number: 3, sort_order: 1 },
      { id: "pickup-2", number: 2, sort_order: 1 },
      { id: "pickup-1", number: 1, sort_order: 0 },
    ];

    const result = getNextPickupNumberFromLists(candidates, [1, 2]);

    expect(result).toEqual({
      pickupNumberId: "pickup-3",
      pickupNumber: 3,
    });
  });

  it("returns null when every eligible number is used", () => {
    const candidates = [
      { id: "pickup-1", number: 1, sort_order: 0 },
      { id: "pickup-2", number: 2, sort_order: 1 },
    ];

    expect(getNextPickupNumberFromLists(candidates, [1, 2])).toBeNull();
  });

  it("does not mutate input arrays", () => {
    const candidates = [
      { id: "pickup-3", number: 3, sort_order: 2 },
      { id: "pickup-1", number: 1, sort_order: 0 },
      { id: "pickup-2", number: 2, sort_order: 1 },
    ];
    const usedNumbers = [1];
    const originalCandidates = structuredClone(candidates);
    const originalUsedNumbers = [...usedNumbers];

    getNextPickupNumberFromLists(candidates, usedNumbers);

    expect(candidates).toEqual(originalCandidates);
    expect(usedNumbers).toEqual(originalUsedNumbers);
  });

  it("handles PICUP PICNIC NIGHT and B pickup number ranges", () => {
    const nightCandidates = [
      { id: "night-1", number: 1, sort_order: 1 },
      { id: "night-2", number: 2, sort_order: 2 },
      { id: "night-3", number: 3, sort_order: 3 },
    ];
    const bCandidates = [
      { id: "b-17", number: 17, sort_order: 17 },
      { id: "b-18", number: 18, sort_order: 18 },
      { id: "b-19", number: 19, sort_order: 19 },
    ];

    expect(getNextPickupNumberFromLists(nightCandidates, [1])).toEqual({
      pickupNumberId: "night-2",
      pickupNumber: 2,
    });
    expect(getNextPickupNumberFromLists(bCandidates, [])).toEqual({
      pickupNumberId: "b-17",
      pickupNumber: 17,
    });
  });
});
