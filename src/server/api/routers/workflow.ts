import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "env";
import { inngest } from "~/inngest/client";

export const workflowRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({ name: z.string().min(1, "Name is required") }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = await auth();

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return ctx.db.workflow.create({
        data: {
          name: input.name,
          userId: userId,
        },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workflow.findFirst({
        where: {
          id: input.id,
        },
      });
    }),

  runLLM: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        system: z.string().optional(),
        imageURL: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = await auth();
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      try {
        // Create an execution record
        const execution = await ctx.db.execution.create({
          data: {
            status: "PENDING",
          },
        });

        // Dipatch to Inngest
        await inngest.send({
          name: "llm/run",
          data: {
            executionId: execution.id,
            prompt: input.prompt,
            system: input.system,
            imageURL: input.imageURL,
          },
        });

        return { executionId: execution.id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error("RunLLM Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown Error",
        });
      }
    }),

  getExecution: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = await auth();
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const exec = await ctx.db.execution.findUnique({
        where: { id: input.id },
      });

      if (!exec) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return exec;
    }),

  save: publicProcedure
    .input(
      z.object({
        id: z.string(),
        definition: z.custom<any>((val) => {
          return typeof val === "object" && val !== null;
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = await auth();
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      return ctx.db.workflow.update({
        where: {
          id: input.id,
        },
        data: {
          definition: input.definition,
        },
      });
    }),
});

