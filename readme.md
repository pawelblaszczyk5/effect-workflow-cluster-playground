# Running locally

The code currently it's adjusted for Fly.io - but there's a patch for running it locally `localhost.patch`

Run database:

```sh
docker run --name local-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=web \
  -p 5432:5432 \
  -d postgres:17
```

Run cluster with default count:

```sh
pnpm start
```

Run cluster with custom count:

```sh
pnpm start 5
```

Query how sharding looks like:

```sql
SELECT address, COUNT(*) AS shard_count
FROM public.cluster_shards
GROUP BY address
ORDER BY shard_count DESC;
```

# Deploying to Fly.io

1. Create an app for the database `fly launch --config database.fly.toml --no-deploy`
1. Add secrets for the database `fly secrets set POSTGRES_PASSWORD=GENERATED_SAFE_VALUE APP_PASSWORD=GENERATED_SAFE_VALUE_2 -c database.fly.toml`
1. Create a volume for the database `fly volume create data -n 1 -s 1 -c database.fly.toml`
1. Deploy the database `fly deploy --ha=false -c database.fly.toml`
1. Create an app for the shard-manager `fly launch --config shard-manager.fly.toml --no-deploy`
1. Set the DB password to the same value as `APP_PASSWORD` previously `fly secrets set POSTGRES_PASSWORD=GENERATED_SAFE_VALUE_2 -c shard-manager.fly.toml`
1. Deploy the shard-manager `fly deploy --ha=false -c shard-manager.fly.toml`
1. Create an app for the runner `fly launch --config runner.fly.toml --no-deploy`
1. Set the DB password to the same value as `APP_PASSWORD` previously `fly secrets set POSTGRES_PASSWORD=GENERATED_SAFE_VALUE_2 -c runner.fly.toml`
1. Deploy the shard-manager `fly deploy --ha=false -c runner.fly.toml`

(you'll need to change some names/values probably)

Few other things:

- Proxying postgres locally - `fly proxy 5432:5432 -c database.fly.toml`
- Scaling runner to multiple instances - `fly scale count NUMBER -c runner.fly.toml`
