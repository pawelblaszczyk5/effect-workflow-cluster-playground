import {
  ClusterWorkflowEngine,
  RunnerAddress,
  EntityProxy,
  EntityProxyServer,
  Entity,
  ClusterCron,
} from "@effect/cluster";
import {
  NodeClusterRunnerSocket,
  NodeRuntime,
  NodeHttpServer,
} from "@effect/platform-node";
import {
  Cron,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Ref,
  Schema,
} from "effect";
import { SqlLayer } from "./sql.ts";
import { Counter, SendEmail } from "./schema.ts";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiSwagger,
  HttpMiddleware,
} from "@effect/platform";
import { createServer } from "node:http";
import {
  Activity,
  DurableClock,
  WorkflowProxy,
  WorkflowProxyServer,
} from "@effect/workflow";

const RunnerProxyApi = HttpApi.make("RunnerProxyApi")
  .add(EntityProxy.toHttpApiGroup("counter", Counter).prefix("/counter"))
  .add(
    WorkflowProxy.toHttpApiGroup("workflows", [SendEmail]).prefix("/workflows")
  );

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(
    HttpApiBuilder.api(RunnerProxyApi).pipe(
      Layer.provide(
        EntityProxyServer.layerHttpApi(RunnerProxyApi, "counter", Counter)
      ),
      Layer.provide(
        WorkflowProxyServer.layerHttpApi(RunnerProxyApi, "workflows", [
          SendEmail,
        ])
      )
    )
  ),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 8080 }))
);

const CounterLive = Counter.toLayer(
  Effect.gen(function* () {
    const entityAddress = yield* Entity.CurrentAddress;

    yield* Effect.log(`Constructing entity for ${entityAddress.entityId}`);

    yield* Effect.addFinalizer(
      Effect.fn(function* () {
        yield* Effect.log(
          `Deconstructing entity for ${entityAddress.entityId}`
        );
      })
    );

    const value = yield* Ref.make(0);

    return {
      Increment: Effect.fn(function* (envelope) {
        yield* Effect.log(`Incrementing by ${envelope.payload.count}`);

        yield* Ref.update(
          value,
          (currentValue) => currentValue + envelope.payload.count
        );
      }),
      Get: Effect.fn(function* () {
        yield* Effect.log("Extracting value");

        return yield* Ref.get(value);
      }),
    };
  }),
  { maxIdleTime: Duration.minutes(15) }
);

const SendEmailLive = SendEmail.toLayer(
  Effect.fn(function* (payload) {
    yield* Activity.make({
      name: "TriggerSend",
      error: Schema.Never,
      execute: Effect.gen(function* () {
        yield* Effect.log(`Sending email to ${payload.to}, awaiting delivery`);
      }),
    });

    yield* DurableClock.sleep({
      name: "AwaitDelivery",
      duration: Duration.minutes(1),
    });

    yield* Activity.make({
      name: "NotifyBeingDelivered",
      error: Schema.Never,
      execute: Effect.gen(function* () {
        yield* Effect.log(
          `Email is confirmed to be delivered to ${payload.to} by now`
        );
      }),
    });
  })
);

const CronTest = ClusterCron.make({
  name: "CronTest",
  execute: Effect.gen(function* () {
    const now = yield* DateTime.now;

    yield* Effect.log(`Cronning at ${DateTime.formatIso(now)}`);
  }),
  cron: Cron.unsafeParse("* * * * *"),
});

const WorkflowEngineLive = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(
    NodeClusterRunnerSocket.layer({
      storage: "sql",
      shardingConfig: {
        runnerAddress: Option.some(
          RunnerAddress.make(
            `${process.env["FLY_MACHINE_ID"]}.vm.workflow-nameless-sunset-6743.internal`,
            34430
          )
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

const EntitiesLive = Layer.mergeAll(CounterLive, CronTest);

const WorkflowsLive = Layer.mergeAll(SendEmailLive);

const EnvironmentLive = Layer.mergeAll(
  EntitiesLive.pipe(
    Layer.provide(WorkflowsLive),
    Layer.provide(WorkflowEngineLive)
  ),
  ServerLive.pipe(Layer.provide(WorkflowEngineLive))
);

EnvironmentLive.pipe(Layer.launch, NodeRuntime.runMain);
