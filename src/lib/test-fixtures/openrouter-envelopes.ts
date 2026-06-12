/** OpenRouter chat completion envelope builders for service contract tests only. */

export function openRouterChatEnvelope(content: string): unknown {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

export function openRouterSuccessResponse(content: string): Response {
  return Response.json(openRouterChatEnvelope(content));
}

export function openRouterHttpErrorResponse(status: number, body = "upstream error"): Response {
  return new Response(body, { status });
}
