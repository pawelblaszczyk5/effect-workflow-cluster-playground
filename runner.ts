import {
  ClusterWorkflowEngine,
  RunnerAddress,
  Singleton,
} from "@effect/cluster";
import { NodeClusterRunnerSocket, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlLayer } from "./sql.ts";
import { Counter, EmailSender, EmailWorkflow } from "./schema.ts";
import { Activity, DurableClock } from "@effect/workflow";

const CounterLive = Counter.toLayer(
  Effect.gen(function* () {
    return {
      Increment: Effect.fn(function* (envelope) {
        yield* Effect.log("Incrementing", envelope.payload.count);
      }),
    };
  })
);

const EmailSenderLive = EmailSender.toLayer(
  Effect.gen(function* () {
    return {
      Send: Effect.fn(function* (envelope) {
        yield* EmailWorkflow.execute(
          {
            to: envelope.payload.to,
            id: crypto.randomUUID(),
          },
          { discard: true }
        );
      }),
    };
  })
);

const CronTest = Singleton.make(
  "CronTest",
  Effect.gen(function* () {
    yield* Effect.log("Starting singleton in cluster");

    yield* Effect.addFinalizer(() =>
      Effect.log("Stopping singleton in cluster")
    );
  })
);

const EmailWorkflowLive = EmailWorkflow.toLayer(
  Effect.fn(function* (payload, executionId) {
    yield* Activity.make({
      name: "SendEmail",
      error: Schema.Never,
      execute: Effect.gen(function* () {
        yield* Effect.log("Sending email", payload, executionId);
      }),
    });

    yield* Effect.log("Sleeping for 2 minutes");
    yield* DurableClock.sleep({
      name: "Waiting after sending",
      duration: "2 minutes",
    });
    yield* Effect.log("Woke up");

    yield* Activity.make({
      name: "EmailDeliveryNotification",
      error: Schema.Never,
      execute: Effect.gen(function* () {
        yield* Effect.log("Email should be delivered by now");
      }),
    });
  })
);

const WorkflowEngineLayer = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(
    NodeClusterRunnerSocket.layer({
      storage: "sql",
      shardingConfig: {
        runnerAddress: Option.some(RunnerAddress.make("localhost", 34432)),
      },
    })
  ),
  Layer.provideMerge(SqlLayer)
);

const Entities = Layer.mergeAll(CounterLive, CronTest, EmailSenderLive);

const Workflows = Layer.mergeAll(EmailWorkflowLive);

const EnvLayer = Entities.pipe(
  Layer.provide(Workflows),
  Layer.provide(WorkflowEngineLayer)
);

EnvLayer.pipe(Layer.launch, NodeRuntime.runMain);
