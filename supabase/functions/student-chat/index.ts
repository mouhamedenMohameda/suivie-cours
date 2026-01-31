import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY manquant." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { studentName, studentNotes, messages } = await req.json();
    const safeMessages = Array.isArray(messages) ? (messages as ChatMessage[]) : [];

    const systemPrompt = [
      "Tu es un assistant pédagogique.",
      "Objectif: aider l'enseignant à suivre la progression de l'étudiant et proposer des cours adaptés.",
      "Réponds toujours en français, de manière claire et structurée.",
      `Étudiant: ${studentName ?? "inconnu"}.`,
      studentNotes ? `Notes: ${studentNotes}.` : ""
    ]
      .filter(Boolean)
      .join(" ");

    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      ...safeMessages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }))
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: text }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Pas de réponse.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
