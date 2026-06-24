import { Badge } from "@/components/ui/badge";
import {
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/reservations/status";

type StatusBadgeProps = {
  status: ReservationStatus;
};

const statusVariants: Record<
  ReservationStatus,
  "default" | "secondary" | "outline"
> = {
  reserved: "default",
  guide_sms_sent: "secondary",
  in_use: "default",
  return_photo_pending: "outline",
  returned: "secondary",
  review_photo_pending: "outline",
  deposit_refunded: "secondary",
  completed: "secondary",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]}>
      {RESERVATION_STATUS_LABELS[status]}
    </Badge>
  );
}
