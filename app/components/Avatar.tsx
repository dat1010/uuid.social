type AvatarProps = {
  displayName: string;
  username: string;
  hasAvatar: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "w-9 text-sm",
  md: "w-12 text-lg",
  lg: "w-24 text-3xl",
};

export function Avatar({
  displayName,
  username,
  hasAvatar,
  size = "md",
}: AvatarProps) {
  const sizeClass = sizes[size];

  if (hasAvatar) {
    return (
      <div className="avatar">
        <div className={`${sizeClass} rounded-full`}>
          <img
            alt={`${displayName}'s profile`}
            src={`/avatar/${encodeURIComponent(username)}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder">
      <div className={`${sizeClass} bg-primary text-primary-content rounded-full`}>
        <span className="font-bold">{displayName.slice(0, 1).toUpperCase()}</span>
      </div>
    </div>
  );
}
