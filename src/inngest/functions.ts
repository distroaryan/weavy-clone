import { inngest } from "./client";
import { env } from "env";
import { db } from "~/server/db";

export const runLLMFunction = inngest.createFunction(
  { id: "run-llm-function", event: "llm/run" },
  async ({ event, step }) => {
    const { executionId, prompt, system, imageURL } = event.data;

    await step.run("execute-llm", async () => {
      try {
        if (imageURL) {
          const lowerUrl = imageURL.toLowerCase();
          const isDataUrl = lowerUrl.startsWith("data:image/") || lowerUrl.startsWith("http");

          if (!isDataUrl) {
            throw new Error("Invalid image URL: Must be a Base64 Data URL or HTTP URL.");
          }
        }

        const apiKey = env.GROQ_API_KEY;
        const { Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey });

        const messages: any[] = [];

        if (system) {
          messages.push({
            role: "system",
            content: system
          });
        }

        const userContent: any[] = [{ type: "text", text: prompt }];

        if (imageURL) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: imageURL,
            }
          });
        }

        messages.push({
          role: "user",
          content: userContent
        });

        const completion = await groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
        });

        const text = completion.choices[0]?.message?.content || "";

        await db.execution.update({
          where: { id: executionId },
          data: {
            status: "COMPLETED",
            result: text,
          },
        });

        return { result: text };
      } catch (error) {
        console.error("RunLLM Error:", error);
        
        await db.execution.update({
          where: { id: executionId },
          data: {
            status: "FAILED",
            result: error instanceof Error ? error.message : "Unknown Error",
          },
        });
        
        throw error;
      }
    });
  }
);
