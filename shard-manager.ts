import {
  NodeClusterShardManagerSocket,
  NodeRuntime,
} from "@effect/platform-node";
import { Layer } from "effect";
import { SqlLayer } from "./sql.ts";
import { RunnerAddress } from "@effect/cluster";

NodeClusterShardManagerSocket.layer({
  storage: "sql",
  shardingConfig: {
    shardManagerAddress: RunnerAddress.make(
      "workflow-billowing-dream-4303.internal",
      8080
    ),
  },
}).pipe(Layer.provide(SqlLayer), Layer.launch, NodeRuntime.runMain);
