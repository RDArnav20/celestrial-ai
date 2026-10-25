
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Celestrial AI, a helpful, intelligent AI assistant.

Your personality:
- Friendly, professional, and clear.
- Give accurate and useful answers.
- Help users with coding, writing, learning, and problem solving.
- Explain code in simple terms when needed.
- Never claim to have searched the internet unless search was actually used.
- Never pretend to have read a file that was not provided.
`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      message,
      history = [],
      mode = "chat",
      file,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Please enter a message." },
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
      .map((item: any) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.text }],
      }));

    const userParts: any[] = [
      {
        text:
          mode === "coding"
            ? `Help me with this coding question:\n${message}`
            : mode === "search"
            ? `Answer this question using Google Search when useful. Include relevant source URLs in your answer:\n${message}`
            : mode === "file"
            ? `Analyze the attached file and answer this question:\n${message}`
            : message,
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
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools:
          mode === "search"
            ? [{ googleSearch: {} }]
            : undefined,
      },
    });

    return NextResponse.json({
      reply: response.text || "I couldn't generate a response.",
    });
  } catch (error) {
    console.error("Celestrial AI error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong. Please try again or check your API quota.",
      },
      { status: 500 }
    );
  }
}
