import { eq } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/profile";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { users } from "../db/schema";
import { requireUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

const maxAvatarBytes = 2 * 1024 * 1024;
const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function meta() {
  return [{ title: "Edit profile | uuid.social" }];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return { currentUser: await requireUser(request, context) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const formData = await request.formData();
  const status = String(formData.get("status") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatar = formData.get("avatar");

  if (status.length > 80) {
    return data({ error: "Status must be 80 characters or fewer." }, { status: 400 });
  }
  if (bio.length > 500) {
    return data({ error: "Bio must be 500 characters or fewer." }, { status: 400 });
  }
  if (avatar instanceof File && avatar.size > 0) {
    if (!avatarTypes.has(avatar.type)) {
      return data({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (avatar.size > maxAvatarBytes) {
      return data({ error: "Profile images must be 2 MB or smaller." }, { status: 400 });
    }
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [existing] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);
  let avatarKey = existing?.avatarKey ?? null;

  if (formData.get("removeAvatar") === "on") {
    avatarKey = null;
  } else if (avatar instanceof File && avatar.size > 0) {
    avatarKey = `avatars/${currentUser.id}/${crypto.randomUUID()}`;
    await env.AVATARS.put(avatarKey, avatar.stream(), {
      httpMetadata: { contentType: avatar.type },
    });
  }

  await db
    .update(users)
    .set({ status: status || null, bio: bio || null, avatarKey, updatedAt: new Date() })
    .where(eq(users.id, currentUser.id));

  if (existing?.avatarKey && existing.avatarKey !== avatarKey) {
    await env.AVATARS.delete(existing.avatarKey);
  }

  return redirect(`/user/${currentUser.username}`);
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser } = loaderData;
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8">
        <div className="navbar-start">
          <Link className="font-bold tracking-widest uppercase text-sm" to="/home">uuid.social</Link>
        </div>
        <div className="navbar-end gap-2">
          <ThemeToggle />
          <Link className="btn btn-ghost btn-sm" to="/home">Home</Link>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="card bg-base-100 shadow">
          <Form className="card-body gap-5" encType="multipart/form-data" method="post">
            <div>
              <h1 className="card-title text-2xl">Edit profile</h1>
              <p className="text-sm text-base-content/50 mt-1">@{currentUser.username}</p>
            </div>
            <div className="flex items-center gap-4">
              <Avatar {...currentUser} size="lg" />
              <fieldset className="fieldset flex-1">
                <legend className="fieldset-legend">Profile image</legend>
                <input className="file-input file-input-bordered w-full" accept="image/jpeg,image/png,image/webp" name="avatar" type="file" />
                <p className="fieldset-label">JPEG, PNG, or WebP. Maximum 2 MB.</p>
              </fieldset>
            </div>
            {currentUser.hasAvatar && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input className="checkbox checkbox-sm" name="removeAvatar" type="checkbox" />
                Remove current image
              </label>
            )}
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Status</legend>
              <input className="input input-bordered w-full" defaultValue={currentUser.status ?? ""} maxLength={80} name="status" placeholder="What are you up to?" />
              <p className="fieldset-label">Up to 80 characters.</p>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Bio</legend>
              <textarea className="textarea textarea-bordered min-h-32 w-full resize-y" defaultValue={currentUser.bio ?? ""} maxLength={500} name="bio" placeholder="Tell people a little about yourself." />
              <p className="fieldset-label">Up to 500 characters.</p>
            </fieldset>
            {actionData?.error && <div className="alert alert-error text-sm" role="alert"><span>{actionData.error}</span></div>}
            <div className="card-actions justify-end">
              <Link className="btn btn-ghost" to={`/user/${currentUser.username}`}>Cancel</Link>
              <button className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Save profile"}</button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
