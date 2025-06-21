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
import { Cron, DateTime, Duration, Effect, Layer, Option, Ref } from "effect";
import { SqlLayer } from "./sql.ts";
import { Counter } from "./schema.ts";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiSwagger,
  HttpMiddleware,
} from "@effect/platform";
import { createServer } from "node:http";

const CounterApi = HttpApi.make("CounterApi").add(
  EntityProxy.toHttpApiGroup("counter", Counter).prefix("/counter")
);

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(
    HttpApiBuilder.api(CounterApi).pipe(
      Layer.provide(
        EntityProxyServer.layerHttpApi(CounterApi, "counter", Counter)
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

const WorkflowsLive = Layer.empty;

const EnvironmentLive = Layer.mergeAll(
  EntitiesLive.pipe(
    Layer.provide(WorkflowsLive),
    Layer.provide(WorkflowEngineLive)
  ),
  ServerLive.pipe(Layer.provide(WorkflowEngineLive))
);

EnvironmentLive.pipe(Layer.launch, NodeRuntime.runMain);
