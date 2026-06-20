export const socialPageSize = 50;

export type SocialView = "followers" | "following";

export type SocialUser = {
  username: string;
  displayName: string;
  hasAvatar: boolean;
};

export type SocialFollow = {
  followerUsername: string;
  followingUsername: string;
  createdAt: string;
};

export type SocialGraph = {
  center: SocialUser;
  nodes: SocialUser[];
  follows: SocialFollow[];
  counts: { followers: number; following: number };
  truncated: boolean;
};

export function parseSocialView(value: string | null): SocialView {
  return value === "following" ? "following" : "followers";
}

export function parsePage(value: string | null) {
  return Math.max(1, Number.parseInt(value ?? "1", 10) || 1);
}

export function buildSocialGraph(input: {
  center: SocialUser;
  followers: SocialUser[];
  following: SocialUser[];
  follows: SocialFollow[];
  counts: { followers: number; following: number };
}): SocialGraph {
  const nodes = new Map<string, SocialUser>([[input.center.username, input.center]]);
  for (const user of [...input.followers, ...input.following]) {
    nodes.set(user.username, user);
  }

  const visibleUsernames = new Set(nodes.keys());
  return {
    center: input.center,
    nodes: [...nodes.values()],
    follows: input.follows.filter(
      (follow) =>
        visibleUsernames.has(follow.followerUsername) &&
        visibleUsernames.has(follow.followingUsername),
    ),
    counts: input.counts,
    truncated:
      input.counts.followers > input.followers.length ||
      input.counts.following > input.following.length,
  };
}
