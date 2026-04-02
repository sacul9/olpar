import { NextRequest, NextResponse } from "next/server";

export function requireApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey || apiKey !== process.env.SCANNER_API_KEY) {
    return NextResponse.json(
      { error: "API key invalida o faltante" },
      { status: 401 }
    );
  }

  return null; // Valid — proceed
}
