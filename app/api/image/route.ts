
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Please enter an image prompt." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      (part: any) => part.inlineData?.data
    );

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        {
          error:
            "The image model did not return an image. Check model access and quota.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image:
        `data:${imagePart.inlineData.mimeType};base64,` +
        imagePart.inlineData.data,
    });
  } catch (error) {
    console.error("Image generation error:", error);

    return NextResponse.json(
      {
        error:
          "Image generation failed. Check your image model access and quota.",
      },
      { status: 500 }
    );
  }
}
