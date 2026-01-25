import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateDietViaAI = async (prompt) => {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You generate gym diet plans only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 3500,
    });

    const raw = response.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();

    return JSON.parse(raw);
  } catch (error) {
    console.error("AI ERROR:", error);
    throw new Error("AI diet generation failed");
  }
};
