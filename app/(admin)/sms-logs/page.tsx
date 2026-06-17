import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type SmsLogRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  status: "success" | "failed";
  rendered_body: string;
  failure_reason: string | null;
  provider: string;
  sent_at: string;
};

export default async function SmsLogsPage() {
  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("sms_logs")
    .select(
      [
        "id",
        "recipient_name",
        "recipient_phone",
        "status",
        "rendered_body",
        "failure_reason",
        "provider",
        "sent_at",
      ].join(", "),
    )
    .order("sent_at", { ascending: false })
    .limit(100);
  const smsLogs = (logs ?? []) as unknown as SmsLogRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">문자 로그</h1>
        <p className="text-sm text-muted-foreground">
          최근 문자 발송 100건의 성공과 실패 내역을 확인합니다.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          문자 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {!error && smsLogs.length === 0 ? (
        <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
          아직 문자 발송 기록이 없습니다.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {smsLogs.map((log) => (
          <Card key={log.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle>{log.recipient_name}</CardTitle>
                  <CardDescription>
                    {formatPhone(log.recipient_phone)} · {log.provider} ·{" "}
                    {formatSentAt(log.sent_at)}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    log.status === "success" ? "secondary" : "destructive"
                  }
                >
                  {log.status === "success" ? "성공" : "실패"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm leading-6">
                {log.rendered_body}
              </p>
              {log.failure_reason ? (
                <p className="text-sm text-destructive">
                  실패 이유: {log.failure_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatSentAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
