import { redirect } from "react-router";

import type { Route } from "./+types/legacy-post";
import { validateUuid } from "../services/auth.server";

export function loader({ params }: Route.LoaderArgs) {
  const uuid = params.uuid?.toLowerCase();
  if (!uuid || !validateUuid(uuid)) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  return redirect(`/record/${uuid}`, 301);
}
