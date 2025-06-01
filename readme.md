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
