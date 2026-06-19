import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { destroyUserSession } from "../services/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  const cookie = await destroyUserSession(request, context);
  return redirect("/", { headers: { "Set-Cookie": cookie } });
}
