
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    return Number((error as { status: unknown }).status);
  }
  return 0;
}

function isRetryable(error: unknown): boolean {
  const status = getStatus(error);
  return status === 429 || status === 503 || status >= 500;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is missing in Vercel environment variables." },
      { status: 500 }
    );
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Please try again." },
      { status: 400 }
    );
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];
  const mode =
    typeof body.mode === "string" ? body.mode : "chat";
  const file = body.file;

  if (!message && !(file?.data && file?.mimeType)) {
    return NextResponse.json(
      { error: "Please enter a message or attach a file." },
      { status: 400 }
    );
  }

  const contents: any[] = history
    .filter(
      (item: any) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.text === "string"
    )
    .slice(-10)
    .map((item: any) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text }],
    }));

  const userParts: any[] = [
    { text: message || "Please analyze the attached file." },
  ];

  if (file?.data && file?.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    });
  }

  contents.push({
    role: "user",
    parts: userParts,
  });

  const instructions: Record<string, string> = {
    chat: "Answer clearly, helpfully, and directly. Keep simple answers concise.",
    coding:
      "You are an expert programming assistant. Provide accurate code, explain important steps, and offer practical solutions.",
    search:
      "Help answer research questions. Never claim to have searched the live web unless a web-search tool was actually used. Be transparent if information may be outdated.",
    file:
      "Carefully analyze the attached file. Base your answer on its contents and clearly state when something cannot be determined from it.",
  };

  const systemInstruction =
    "You are Celestrial AI, a friendly and intelligent AI assistant. Help with questions, coding, writing, learning, and problem solving. " +
    (instructions[mode] || instructions.chat);

  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentText = false;

      try {
        let completed = false;

        for (let attempt = 0; attempt < 3 && !completed; attempt++) {
          try {
            const result = await ai.models.generateContentStream({
              model: "gemini-3.6-flash",
              contents,
              config: {
                systemInstruction,
                maxOutputTokens: 2048,
              },
            });

            // Retry only if the request fails before any text is sent.
            for await (const chunk of result) {
              const chunkText = chunk.text;

              if (chunkText) {
                sentText = true;
                controller.enqueue(encoder.encode(chunkText));
              }
            }

            completed = true;
          } catch (error) {
            console.error(
              `Celestrial AI attempt ${attempt + 1} failed:`,
              error
            );

            if (
              sentText ||
              !isRetryable(error) ||
              attempt === 2
            ) {
              throw error;
            }

            // Exponential backoff: 1 second, then 2 seconds.
            await sleep(1000 * 2 ** attempt);
          }
        }

        controller.close();
      } catch (error) {
        console.error("Celestrial AI request failed:", error);

        const status = getStatus(error);

        const friendlyMessage =
          status === 429
            ? "\n\nGoogle AI is receiving too many requests right now. Please wait a moment and try again."
            : status === 503
              ? "\n\nGoogle AI is temporarily overloaded. Please try again shortly."
              : status >= 500
                ? "\n\nGoogle AI is temporarily unavailable. Please try again shortly."
                : "\n\nCelestrial AI could not finish this response. Please try again.";

        try {
          controller.enqueue(encoder.encode(friendlyMessage));
          controller.close();
        } catch {
          // The connection may already be closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

