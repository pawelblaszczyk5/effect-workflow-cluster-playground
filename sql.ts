import { PgClient } from "@effect/sql-pg";
import { Function, Redacted } from "effect";

export const SqlLayer = PgClient.layer({
  database: "web",
  username: "postgres",
  password: Redacted.make("postgres"),
  host: "localhost",
  port: 5432,
  onnotice: Function.constVoid,
});
