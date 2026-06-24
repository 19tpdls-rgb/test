export type PickupNumberCandidate = {
  id: string;
  number: number;
  sort_order: number;
};

export type PickupNumberAllocation = {
  pickupNumberId: string;
  pickupNumber: number;
};

export function getNextPickupNumberFromLists(
  candidates: PickupNumberCandidate[],
  usedNumbers: number[],
): PickupNumberAllocation | null {
  const usedNumberSet = new Set(usedNumbers);
  const nextCandidate = [...candidates]
    .sort((a, b) => a.sort_order - b.sort_order || a.number - b.number)
    .find((candidate) => !usedNumberSet.has(candidate.number));

  if (!nextCandidate) {
    return null;
  }

  return {
    pickupNumberId: nextCandidate.id,
    pickupNumber: nextCandidate.number,
  };
}
