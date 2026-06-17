import { ReservationForm } from "@/components/reservation-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewReservationPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, code, base_price, deposit_amount")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">예약 등록</h1>
        <p className="text-sm text-muted-foreground">
          고객 예약 정보를 입력하면 보증금 환불 항목도 함께 준비됩니다.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <ReservationForm products={products ?? []} />
      )}
    </div>
  );
}
