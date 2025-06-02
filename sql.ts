import { PgClient } from "@effect/sql-pg";
import { Config, Function } from "effect";

export const SqlLayer = PgClient.layerConfig({
  database: Config.sync(() => "cluster"),
  username: Config.sync(() => "cluster"),
  password: Config.redacted("POSTGRES_PASSWORD"),
  host: Config.sync(() => "workflow-damp-feather-971.internal"),
  port: Config.sync(() => 5432),
  onnotice: Config.sync(() => Function.constVoid),
});
