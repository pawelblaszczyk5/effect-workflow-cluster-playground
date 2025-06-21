import { Entity } from "@effect/cluster";
import { Rpc } from "@effect/rpc";
import { Schema } from "effect";

export const Counter = Entity.make("Counter", [
  Rpc.make("Increment", {
    payload: {
      count: Schema.Int,
    },
  }),
  Rpc.make("Get", {
    success: Schema.Int,
  }),
]);
