import { Ban, CircleCheck, Clock, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const JOB = { queued: ["sky", "Queued", Clock], running: ["sky", "Running", LoaderCircle], succeeded: ["moss", "Reminder sent", CircleCheck], failed: ["rose", "Failed", TriangleAlert], cancelled: ["neutral", "Cancelled", Ban] };

/** A job that failed once and is waiting for its next try is "Retrying (2/3)", not "Queued". */
export function JobStatusBadge({ job }) {
  if (!job) return null;
  const retry = job.status === "queued" && job.attempts > 0;
  const [tone, label, icon] = retry ? ["amber", `Retrying (${job.attempts}/${job.max_attempts})`, RotateCw] : JOB[job.status];
  return <Badge tone={tone} icon={icon}>{label}</Badge>;
}
