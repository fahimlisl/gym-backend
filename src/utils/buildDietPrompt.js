export const buildDietPrompt = (data) => `
You are a certified fitness nutrition assistant.

Create a 7-day Indian diet plan.

Details:
- Goal: ${data.goal}
- Calories per day: ${data.calories}
- Diet type: ${data.dietType}
- Meals per day: ${data.mealsPerDay}

Rules:
- Use common Indian foods
- High protein focus
- Avoid medical claims
- Mention portion sizes
- Output STRICT JSON only

JSON format:
{
  "day1": [
    { "meal": "", "items": [], "calories": 0, "protein": 0 }
  ],
  "day2": []
}
`;
