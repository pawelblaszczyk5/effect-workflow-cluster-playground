import { PgClient } from "@effect/sql-pg";
import { Redacted } from "effect";

export const SqlLayer = PgClient.layer({
  database: "web",
  username: "postgres",
  password: Redacted.make("postgres"),
  host: "localhost",
  port: 5432,
});
