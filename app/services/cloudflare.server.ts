type AppEnv = Env & {
  AUTH_PEPPER: string;
};

type AppLoadContext = {
  cloudflare: {
    env: AppEnv;
    ctx: ExecutionContext;
  };
};

export function getCloudflareEnv(context: unknown) {
  return (context as AppLoadContext).cloudflare.env;
}
