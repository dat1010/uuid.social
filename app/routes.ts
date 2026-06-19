import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("home", "routes/home.tsx"),
  route("record/:uuid", "routes/record.tsx"),
  route("post/:uuid", "routes/legacy-post.tsx"),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
