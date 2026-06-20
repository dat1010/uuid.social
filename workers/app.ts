import { createRequestHandler } from "react-router";
import { ensureCurrentBounties } from "../app/services/bounties.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname === "www.uuid.social") {
      url.hostname = "uuid.social";
      return Response.redirect(url.toString(), 301);
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(ensureCurrentBounties(env.DB));
  },
} satisfies ExportedHandler<Env>;
