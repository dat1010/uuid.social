import { Link } from "react-router";

export type RecordCardData = {
  id: string;
  username: string;
  displayName: string;
  body: string;
  createdAt: string;
};

type RecordCardProps = {
  record: RecordCardData;
  className?: string;
};

export function RecordCard({ record, className = "" }: RecordCardProps) {
  return (
    <article className={`p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="avatar avatar-placeholder">
          <div className="bg-primary text-primary-content rounded-full w-9">
            <span className="text-sm font-bold">
              {record.displayName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{record.displayName}</p>
          <p className="text-xs text-base-content/50">
            @{record.username} · {formatRecordDate(record.createdAt)}
          </p>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {record.body}
      </p>
      <p className="mt-4 text-xs text-base-content/50">
        Record UUID:{" "}
        <Link
          className="link link-hover break-all"
          to={`/record/${record.id}`}
        >
          {record.id}
        </Link>
      </p>
    </article>
  );
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
