import { Entity } from "@effect/cluster";
import { Rpc } from "@effect/rpc";
import { Workflow } from "@effect/workflow";
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

export const SendEmail = Workflow.make({
  name: "SendEmail",
  success: Schema.Void,
  error: Schema.Never,
  payload: {
    id: Schema.String,
    to: Schema.String,
  },
  idempotencyKey: ({ id }) => id,
});
