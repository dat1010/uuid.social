import { createRequestHandler } from "react-router";

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
} satisfies ExportedHandler<Env>;
