import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          상세 화면 준비 중
        </h1>
        <p className="text-sm text-muted-foreground">
          예약 상세 화면은 곧 제공될 예정입니다.
        </p>
      </div>

      <div>
        <Button variant="outline" render={<Link href="/reservations" />}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          목록으로
        </Button>
      </div>
    </div>
  );
}
