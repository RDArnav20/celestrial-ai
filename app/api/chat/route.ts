
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in Vercel." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const message = body.message;
    const history = body.history || [];
    const mode = body.mode || "chat";
    const file = body.file;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
    });

    const contents = history
      .filter(
        (item: any) =>
          (item.role === "user" || item.role === "assistant") &&
          typeof item.text === "string"
      )
      .map((item: any) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.text }],
      }));

    const userParts: any[] = [
      {
        text: message,
      },
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction:
          "You are Celestrial AI, a friendly and intelligent AI assistant. Help users with general questions, coding, writing, learning, and problem solving. Explain code clearly.",
      },
    });

    return NextResponse.json({
      reply: response.text || "I could not generate a response.",
    });
  } catch (error) {
    console.error("Celestrial AI error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
