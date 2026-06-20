import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Avatar } from "./Avatar";

export type RecordCardData = {
  id: string;
  username: string;
  displayName: string;
  hasAvatar: boolean;
  body: string;
  createdAt: string;
  replyCount: number;
};

type RecordCardProps = {
  record: RecordCardData;
  className?: string;
};

export function RecordCard({ record, className = "" }: RecordCardProps) {
  return (
    <article className={`p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Link to={`/user/${record.username}`} aria-label={`${record.displayName}'s profile`}>
          <Avatar {...record} size="sm" />
        </Link>
        <div className="min-w-0">
          <Link className="font-bold text-sm truncate link link-hover block" to={`/user/${record.username}`}>
            {record.displayName}
          </Link>
          <p className="text-xs text-base-content/50">
            @{record.username} · <RecordDate value={record.createdAt} />
          </p>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {record.body}
      </p>
      <Link
        className="link link-hover mt-4 inline-block text-xs text-base-content/60"
        to={`/record/${record.id}`}
      >
        {record.replyCount} {record.replyCount === 1 ? "reply" : "replies"}
      </Link>
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

function RecordDate({ value }: { value: string }) {
  const [localDate, setLocalDate] = useState<string | null>(null);

  useEffect(() => {
    setLocalDate(formatRecordDate(value));
  }, [value]);

  return (
    <time dateTime={value}>
      {localDate ?? `${formatRecordDate(value, "UTC", "en-US")} UTC`}
    </time>
  );
}

function formatRecordDate(value: string, timeZone?: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
