
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is missing in Vercel." },
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
  const mode = body.mode || "chat";
  const file = body.file;

  if (!message && !(file?.data && file?.mimeType)) {
    return NextResponse.json(
      { error: "Please enter a message or attach a file." },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

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

  const userParts: any[] = [{ text: message || "Please analyze the attached file." }];

  if (file?.data && file?.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    });
  }

  contents.push({ role: "user", parts: userParts });

  const modeInstructions: Record<string, string> = {
    chat: "Answer clearly, helpfully, and directly. Keep simple answers concise.",
    coding:
      "You are an expert programming assistant. Give accurate code, explain important steps, and keep solutions practical.",
    search:
      "Be honest about your access to current information. Do not claim you searched the live web unless a web-search tool was actually used. Answer from your available knowledge and state when information may be outdated.",
    file:
      "Carefully analyze the user's attached file. Base your answer on its contents and clearly say if something cannot be determined from the file.",
  };

  const systemInstruction =
    "You are Celestrial AI, a friendly and intelligent AI assistant. Help with questions, coding, writing, learning, and problem solving. " +
    (modeInstructions[mode] || modeInstructions.chat);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await ai.models.generateContentStream({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: 2048,
          },
        });

        for await (const chunk of result) {
          const text = chunk.text;

          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (error) {
        console.error("Celestrial AI streaming error:", error);

        const details =
          error instanceof Error ? error.message : String(error);

        const friendlyMessage =
          /503|UNAVAILABLE|high demand|overloaded/i.test(details)
            ? "\n\nCelestrial AI is temporarily busy. Please try again in a little while."
            : "\n\nCelestrial AI could not finish this response. Please try again.";

        try {
          controller.enqueue(encoder.encode(friendlyMessage));
          controller.close();
        } catch {
          // The client may already have disconnected.
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
