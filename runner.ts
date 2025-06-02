import {
  ClusterWorkflowEngine,
  RunnerAddress,
  Singleton,
} from "@effect/cluster";
import {
  NodeClusterRunnerSocket,
  NodeRuntime,
  NodeHttpServer,
} from "@effect/platform-node";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlLayer } from "./sql.ts";
import { Counter, EmailSender, EmailWorkflow } from "./schema.ts";
import { Activity, DurableDeferred } from "@effect/workflow";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
  HttpMiddleware,
} from "@effect/platform";
import { createServer } from "node:http";

const WorkflowProxyApi = HttpApi.make("WorkflowProxyApi").add(
  HttpApiGroup.make("Email")
    .add(
      HttpApiEndpoint.post("send")`/send`
        .setPayload(
          Schema.Struct({
            id: Schema.String,
          })
        )
        .addSuccess(Schema.Null)
    )
    .add(
      HttpApiEndpoint.post("confirm-delivery")`/confirm-delivery`
        .setPayload(
          Schema.Struct({
            id: Schema.String,
          })
        )
        .addSuccess(Schema.Null)
    )
);

const WorkflowProxyApiLive = HttpApiBuilder.group(
  WorkflowProxyApi,
  "Email",
  (handlers) =>
    handlers
      .handle(
        "send",
        Effect.fn(function* (request) {
          const entityId = `email-sender-${request.payload.id}`;

          const emailSender = yield* EmailSender.client.pipe(
            Effect.map((getEmailSender) => getEmailSender(entityId))
          );

          yield* emailSender
            .Send({
              id: request.payload.id,
              to: `test-${request.payload.id}@example.com`,
            })
            .pipe(Effect.orDie);

          return null;
        })
      )
      .handle(
        "confirm-delivery",
        Effect.fn(function* (request) {
          const entityId = `email-sender-${request.payload.id}`;

          const emailSender = yield* EmailSender.client.pipe(
            Effect.map((getEmailSender) => getEmailSender(entityId))
          );

          yield* emailSender
            .ConfirmDelivery({
              id: request.payload.id,
              to: `test-${request.payload.id}@example.com`,
            })
            .pipe(Effect.orDie);

          return null;
        })
      )
);

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(
    HttpApiBuilder.api(WorkflowProxyApi).pipe(
      Layer.provide(WorkflowProxyApiLive)
    )
  ),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 8080 }))
);

const CounterLive = Counter.toLayer(
  Effect.gen(function* () {
    return {
      Increment: Effect.fn(function* (envelope) {
        yield* Effect.log("Incrementing", envelope.payload.count);
      }),
    };
  })
);

const EmailSenderDeliveryDurableDeferred = DurableDeferred.make(
  "EmailSenderDelivery"
);

const EmailSenderLive = EmailSender.toLayer(
  Effect.gen(function* () {
    return {
      Send: Effect.fn(function* (envelope) {
        yield* EmailWorkflow.execute(envelope.payload, { discard: true });
      }),
      ConfirmDelivery: Effect.fn(function* (envelop) {
        const durableDeferredToken = yield* DurableDeferred.tokenFromPayload(
          EmailSenderDeliveryDurableDeferred,
          {
            workflow: EmailWorkflow,
            payload: envelop.payload,
          }
        );

        yield* DurableDeferred.succeed(EmailSenderDeliveryDurableDeferred, {
          token: durableDeferredToken,
          value: undefined,
        });
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

    yield* Effect.log("Awaiting delivery confirmation");

    yield* DurableDeferred.await(EmailSenderDeliveryDurableDeferred);

    yield* Activity.make({
      name: "EmailDeliveryNotification",
      error: Schema.Never,
      execute: Effect.gen(function* () {
        yield* Effect.log("Email is confirmed to be delivered by now");
      }),
    });
  })
);

const WorkflowEngineLive = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(
    NodeClusterRunnerSocket.layer({
      storage: "sql",
      shardingConfig: {
        runnerAddress: Option.some(
          RunnerAddress.make(`${process.env["FLY_MACHINE_ID"]}.vm.workflow-nameless-sunset-6743.internal`, 34430)
        ),
        shardManagerAddress: RunnerAddress.make(
          "workflow-billowing-dream-4303.internal",
          8080
        ),
      },
    })
  ),
  Layer.provideMerge(SqlLayer)
);

const EntitiesLive = Layer.mergeAll(CounterLive, CronTest, EmailSenderLive);

const WorkflowsLive = Layer.mergeAll(EmailWorkflowLive);

const EnvironmentLive = Layer.mergeAll(
  EntitiesLive.pipe(
    Layer.provide(WorkflowsLive),
    Layer.provide(WorkflowEngineLive)
  ),
  ServerLive.pipe(Layer.provide(WorkflowEngineLive))
);

EnvironmentLive.pipe(Layer.launch, NodeRuntime.runMain);
