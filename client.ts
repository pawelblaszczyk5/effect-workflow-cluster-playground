import { NodeClusterRunnerSocket, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { SqlLayer } from "./sql.ts";
import { EmailSender } from "./schema.ts";

const RunnerLive = NodeClusterRunnerSocket.layer({
  clientOnly: true,
  storage: "sql",
}).pipe(Layer.provide(SqlLayer));

const program = Effect.gen(function* () {
  const id = Math.floor(Math.random() * 1000);
  const entityId = `email-sender-${id}`;

  const emailSender = yield* EmailSender.client.pipe(
    Effect.map((getEmailSender) => getEmailSender(entityId))
  );

  yield* emailSender.Send({ to: `test-${id}@example.com` });
});

const replicatedProgram = Effect.all(Effect.replicate(program, 5), {
  discard: true,
});

replicatedProgram.pipe(Effect.provide(RunnerLive), NodeRuntime.runMain);
