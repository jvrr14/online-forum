import type { RequestHandler } from "express";
import { z } from "zod";

export function validate(schema: z.ZodType, target: "body" | "params" | "query"): RequestHandler {
  return (req, res, next) => {
    res.locals[target] = schema.parse(req[target]);
    next();
  };
}
