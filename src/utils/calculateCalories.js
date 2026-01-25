export const calculateCalories = ({ weight, goal }) => {
  if (goal === "fat loss") return weight * 24;
  if (goal === "muscle gain") return weight * 35;
  return weight * 30;
};
