"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ReservationFormProduct = {
  id: string;
  name: string;
  code: string;
  base_price?: number | null;
  deposit_amount?: number | null;
};

type ReservationFormProps = {
  products: ReservationFormProduct[];
};

type FormState = {
  customerName: string;
  customerPhone: string;
  reservationDate: string;
  reservationTime: string;
  productId: string;
  pickupNumber: string;
  pickupNumberId: string | null;
  paymentAmount: string;
  depositAmount: string;
  depositIncluded: boolean;
  reviewEventParticipated: boolean;
  expectedReturnAt: string;
  memo: string;
};

const initialFormState: FormState = {
  customerName: "",
  customerPhone: "",
  reservationDate: "",
  reservationTime: "",
  productId: "",
  pickupNumber: "",
  pickupNumberId: null,
  paymentAmount: "",
  depositAmount: "10000",
  depositIncluded: true,
  reviewEventParticipated: false,
  expectedReturnAt: "",
  memo: "",
};

export function ReservationForm({ products }: ReservationFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickupMessage, setPickupMessage] = useState<string | null>(null);
  const [isPickupLoading, setIsPickupLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!formState.productId || !formState.reservationDate) {
      return;
    }

    const controller = new AbortController();

    async function loadPickupNumber() {
      try {
        setIsPickupLoading(true);
        setPickupMessage("픽업번호를 확인하고 있습니다.");

        const response = await fetch("/api/pickup-number", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: formState.productId,
            reservationDate: formState.reservationDate,
          }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          id?: string;
          number?: number;
          error?: string;
        };

        if (!response.ok || !body.id || typeof body.number !== "number") {
          throw new Error(body.error ?? "픽업번호를 자동으로 가져오지 못했습니다.");
        }

        setFormState((current) => ({
          ...current,
          pickupNumber: String(body.number),
          pickupNumberId: body.id ?? null,
        }));
        setPickupMessage("사용 가능한 픽업번호를 자동으로 넣었습니다.");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setFormState((current) => ({
          ...current,
          pickupNumberId: null,
        }));
        setPickupMessage(
          error instanceof Error
            ? error.message
            : "픽업번호를 자동으로 가져오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsPickupLoading(false);
        }
      }
    }

    loadPickupNumber();

    return () => controller.abort();
  }, [formState.productId, formState.reservationDate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const body = {
      customerName: formState.customerName.trim(),
      customerPhone: formState.customerPhone.trim(),
      reservationDate: formState.reservationDate,
      reservationTime: formState.reservationTime,
      productId: formState.productId,
      pickupNumber: Number(formState.pickupNumber),
      pickupNumberId: formState.pickupNumberId,
      paymentAmount: Number(formState.paymentAmount || 0),
      depositAmount: Number(formState.depositAmount || 0),
      depositIncluded: formState.depositIncluded,
      reviewEventParticipated: formState.reviewEventParticipated,
      expectedReturnAt: formState.expectedReturnAt || null,
      memo: formState.memo.trim() || null,
    };

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "예약을 등록하지 못했습니다.");
      }

      router.push("/reservations");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "예약을 등록하지 못했습니다.",
      );
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="고객 이름" htmlFor="customerName">
              <Input
                id="customerName"
                name="customerName"
                value={formState.customerName}
                onChange={(event) =>
                  updateField("customerName", event.target.value)
                }
                autoComplete="name"
                required
              />
            </Field>
            <Field label="고객 전화번호" htmlFor="customerPhone">
              <Input
                id="customerPhone"
                name="customerPhone"
                value={formState.customerPhone}
                onChange={(event) =>
                  updateField("customerPhone", event.target.value)
                }
                placeholder="010-1234-5678"
                autoComplete="tel"
                required
              />
            </Field>
            <Field label="예약 날짜" htmlFor="reservationDate">
              <Input
                id="reservationDate"
                name="reservationDate"
                type="date"
                value={formState.reservationDate}
                onChange={(event) =>
                  updateField("reservationDate", event.target.value)
                }
                required
              />
            </Field>
            <Field label="예약 시간" htmlFor="reservationTime">
              <Input
                id="reservationTime"
                name="reservationTime"
                type="time"
                value={formState.reservationTime}
                onChange={(event) =>
                  updateField("reservationTime", event.target.value)
                }
                required
              />
            </Field>
            <Field label="상품" htmlFor="productId">
              <Select
                value={formState.productId || null}
                onValueChange={(value) => {
                  const productId = typeof value === "string" ? value : "";
                  const product = products.find(
                    (item) => item.id === productId,
                  );

                  setFormState((current) => ({
                    ...current,
                    productId,
                    paymentAmount:
                      current.paymentAmount ||
                      (product ? String(product.base_price ?? 0) : ""),
                    depositAmount:
                      current.depositAmount ||
                      (product ? String(product.deposit_amount ?? 10000) : ""),
                  }));
                }}
                items={[
                  { label: "상품을 선택하세요", value: null },
                  ...products.map((product) => ({
                    label: `${product.name} (${product.code})`,
                    value: product.id,
                  })),
                ]}
              >
                <SelectTrigger id="productId" className="w-full">
                  <SelectValue placeholder="상품을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={null}>상품을 선택하세요</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.code})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="픽업번호" htmlFor="pickupNumber">
              <Input
                id="pickupNumber"
                name="pickupNumber"
                type="number"
                min="1"
                value={formState.pickupNumber}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pickupNumber: event.target.value,
                    pickupNumberId: null,
                  }))
                }
                required
              />
              {pickupMessage &&
              formState.productId &&
              formState.reservationDate ? (
                <p className="text-sm text-muted-foreground">
                  {isPickupLoading ? "확인 중: " : ""}
                  {pickupMessage}
                </p>
              ) : null}
            </Field>
            <Field label="결제금액" htmlFor="paymentAmount">
              <Input
                id="paymentAmount"
                name="paymentAmount"
                type="number"
                min="0"
                step="1000"
                value={formState.paymentAmount}
                onChange={(event) =>
                  updateField("paymentAmount", event.target.value)
                }
                required
              />
            </Field>
            <Field label="보증금" htmlFor="depositAmount">
              <Input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min="0"
                step="1000"
                value={formState.depositAmount}
                onChange={(event) =>
                  updateField("depositAmount", event.target.value)
                }
                required
              />
            </Field>
            <Field label="예상 반납 일시" htmlFor="expectedReturnAt">
              <Input
                id="expectedReturnAt"
                name="expectedReturnAt"
                type="datetime-local"
                value={formState.expectedReturnAt}
                onChange={(event) =>
                  updateField("expectedReturnAt", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                id="depositIncluded"
                checked={formState.depositIncluded}
                onCheckedChange={(checked) =>
                  updateField("depositIncluded", checked)
                }
              />
              <span className="flex flex-col gap-1">
                <Label htmlFor="depositIncluded">보증금 포함</Label>
                <span className="text-muted-foreground">
                  결제금액에 보증금이 포함된 예약입니다.
                </span>
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                id="reviewEventParticipated"
                checked={formState.reviewEventParticipated}
                onCheckedChange={(checked) =>
                  updateField("reviewEventParticipated", checked)
                }
              />
              <span className="flex flex-col gap-1">
                <Label htmlFor="reviewEventParticipated">
                  리뷰 이벤트 참여
                </Label>
                <span className="text-muted-foreground">
                  리뷰 인증 확인이 필요한 예약입니다.
                </span>
              </span>
            </div>
          </div>

          <Field label="메모" htmlFor="memo">
            <Textarea
              id="memo"
              name="memo"
              value={formState.memo}
              onChange={(event) => updateField("memo", event.target.value)}
              rows={4}
              placeholder="현장 전달사항이나 특이사항을 적어주세요."
            />
          </Field>

          {errorMessage ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              render={<Link href="/reservations" />}
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              목록으로
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2Icon data-icon="inline-start" aria-hidden="true" />
              ) : null}
              예약 등록
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
