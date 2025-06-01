import { Entity, ClusterSchema } from "@effect/cluster";
import { Rpc } from "@effect/rpc";
import { Workflow } from "@effect/workflow";
import { Schema } from "effect";

export const Counter = Entity.make("Counter", [
  Rpc.make("Increment", {
    payload: {
      count: Schema.Int,
    },
    success: Schema.Void,
    error: Schema.Never,
  }),
]).annotateRpcs(ClusterSchema.Persisted, true);

export const EmailSender = Entity.make("EmailSender", [
  Rpc.make("Send", {
    payload: {
      to: Schema.String,
    },
    success: Schema.Void,
    error: Schema.Never,
  }),
]).annotateRpcs(ClusterSchema.Persisted, true);

export const EmailWorkflow = Workflow.make({
  name: "EmailWorkflow",
  success: Schema.Void,
  error: Schema.Never,
  payload: {
    id: Schema.String,
    to: Schema.String,
  },
  idempotencyKey: ({ id }) => id,
});
