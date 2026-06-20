import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("home", "routes/home.tsx"),
  route("bounties", "routes/bounties.tsx"),
  route("bounty/:uuid", "routes/bounty.tsx"),
  route("claim/:uuid", "routes/claim.tsx"),
  route("connection/:uuid", "routes/connection.tsx"),
  route("graph/:uuid", "routes/graph.tsx"),
  route("api/graph/:uuid", "routes/graph-api.ts"),
  route("profile", "routes/profile.tsx"),
  route("user/:username", "routes/user-profile.tsx"),
  route("user/:username/graph", "routes/social-graph.tsx"),
  route("avatar/:username", "routes/avatar.ts"),
  route("record/:uuid", "routes/record.tsx"),
  route("post/:uuid", "routes/legacy-post.tsx"),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
