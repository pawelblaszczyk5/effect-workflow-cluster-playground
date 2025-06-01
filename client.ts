import { NodeClusterRunnerSocket, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { SqlLayer } from "./sql.ts";
import { EmailSender } from "./schema.ts";

const RunnerLive = NodeClusterRunnerSocket.layer({
  clientOnly: true,
  storage: "sql",
}).pipe(Layer.provide(SqlLayer));

const id = "26c4bed0-16f0-4f2d-9203-ec6241b812a5";

const program = Effect.gen(function* () {
  const entityId = `email-sender-${id}`;

  const emailSender = yield* EmailSender.client.pipe(
    Effect.map((getEmailSender) => getEmailSender(entityId))
  );

  yield* emailSender.ConfirmDelivery({ to: `test-${id}@example.com`, id });
});

const replicatedProgram = Effect.all(Effect.replicate(program, 5), {
  discard: true,
});

replicatedProgram.pipe(Effect.provide(RunnerLive), NodeRuntime.runMain);
