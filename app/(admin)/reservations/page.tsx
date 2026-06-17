import Link from "next/link";
import { PlusIcon } from "lucide-react";

import {
  ReservationTable,
  type ReservationTableRow,
} from "@/components/reservation-table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default function ReservationsPage() {
  return <ReservationsList />;
}

async function ReservationsList() {
  const supabase = await createClient();
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("*, products(name, code)")
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">예약 관리</h1>
          <p className="text-sm text-muted-foreground">
            예약을 확인하고 새 예약을 직접 등록합니다.
          </p>
        </div>
        <Button render={<Link href="/reservations/new" />}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          예약 등록
        </Button>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          예약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <ReservationTable
          reservations={(reservations ?? []) as ReservationTableRow[]}
        />
      )}
    </div>
  );
}
