import { Link } from "react-router";

export type PostCardData = {
  id: string;
  username: string;
  displayName: string;
  body: string;
  createdAt: string;
};

type PostCardProps = {
  post: PostCardData;
  className?: string;
};

export function PostCard({ post, className = "" }: PostCardProps) {
  return (
    <article className={`p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="avatar avatar-placeholder">
          <div className="bg-primary text-primary-content rounded-full w-9">
            <span className="text-sm font-bold">
              {post.displayName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{post.displayName}</p>
          <p className="text-xs text-base-content/50">
            @{post.username} · {formatPostDate(post.createdAt)}
          </p>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {post.body}
      </p>
      <p className="mt-4 text-xs text-base-content/50">
        Post UUID:{" "}
        <Link
          className="link link-hover break-all"
          to={`/post/${post.id}`}
        >
          {post.id}
        </Link>
      </p>
    </article>
  );
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
