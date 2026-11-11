import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat-ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChatIA } = await import("@/lib/ia/chat.server");
        return handleChatIA(request, {
          url: process.env["SUPABASE_URL"],
          publishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"],
          geminiKey: process.env["GEMINI_API_KEY"],
          model: process.env["GEMINI_MODEL"],
        });
      },
    },
  },
});
