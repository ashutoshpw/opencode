import { Effect } from "effect"
import { Route } from "../route/client.js"
import { Endpoint } from "../route/endpoint.js"
import { OpenAIChat } from "./openai-chat.js"
import { ProviderShared } from "./shared.js"

const ADAPTER = "openai-compatible-chat"

/**
 * Route for non-OpenAI providers that expose an OpenAI Chat-compatible
 * `/chat/completions` endpoint. Reuses the OpenAI Chat protocol with text
 * compatibility for backends that JSON-parse assistant and tool content.
 * Provider helpers configure the route endpoint before model selection.
 */
export const route = Route.make({
  id: ADAPTER,
  providerMetadataKey: "openai",
  protocol: {
    ...OpenAIChat.protocol,
    body: {
      ...OpenAIChat.protocol.body,
      from: (request) =>
        OpenAIChat.fromRequest(request).pipe(
          Effect.map((body) => ({
            ...body,
            messages: body.messages.map((message) => {
              if (message.role !== "assistant" && message.role !== "tool") return message
              const content = message.content
              if (content === null) return message
              return {
                ...message,
                content:
                  typeof content === "string"
                    ? quoteOverflowingNumber(content)
                    : content.map((part) => ({ ...part, text: quoteOverflowingNumber(part.text) })),
              }
            }),
          })),
        ),
    },
  },
  endpoint: Endpoint.path("/chat/completions"),
  framing: OpenAIChat.framing,
})

function quoteOverflowingNumber(text: string) {
  // LocalAI's llama.cpp backend JSON-sniffs this text and catches parse_error,
  // but not out_of_range. A git hash such as 497e863 overflows even with trailing
  // text. Quote only overflowing numeric prefixes, preserving the original text.
  const number = /^[ \t\r\n]*-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text)
  return number && !Number.isFinite(Number(number[0])) ? ProviderShared.encodeJson(text) : text
}

export * as OpenAICompatibleChat from "./openai-compatible-chat.js"
