import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { Admin } from "../models/admin.models.js";
import { WorkoutTemplate } from "../models/workout.template.models.js";

// 1. CREATE TEMPLATE (WITH ONE WEEK BY DEFAULT)
const createWorkoutTemplate = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    difficultyLevel, 
    goal, 
    duration 
  } = req.body;
  
  const adminId = req.user._id;
  
  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new ApiError(401, "Admin not found. Unauthorized access.");
  }
  if (!name || !difficultyLevel) {
    throw new ApiError(400, "Name and difficulty level are required.");
  }
  const validDifficulties = ["Beginner", "Intermediate", "Advanced"];
  if (!validDifficulties.includes(difficultyLevel)) {
    throw new ApiError(400, `Difficulty level must be one of: ${validDifficulties.join(", ")}`);
  }

  const validGoals = ["Strength", "Hypertrophy", "Endurance", "Weight Loss", "General Fitness"];
  if (goal && !validGoals.includes(goal)) {
    throw new ApiError(400, `Goal must be one of: ${validGoals.join(", ")}`);
  }

  const template = await WorkoutTemplate.create({
    name: name.trim(),
    description: description?.trim() || "",
    difficultyLevel,
    goal: goal || "General Fitness",
    duration: duration || 1, // Default to 1 week
    weeks: [{
      days: [] // One week with no days yet
    }],
    createdBy: admin._id,
  });

  if (!template) {
    throw new ApiError(500, "Failed to create workout template.");
  }

  return res.status(201).json(
    new ApiResponse(201, template, "Workout template created successfully. Now you can add days to it.")
  );
});

// 2. ADD DAY TO THE EXISTING WEEK
const addDayToTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { day, dayNumber, isRestDay, workoutName, notes } = req.body;
  const adminId = req.user._id;

  if (!day) {
    throw new ApiError(400, "Day name is required.");
  }

  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  if (!validDays.includes(day)) {
    throw new ApiError(400, `Day must be one of: ${validDays.join(", ")}`);
  }
  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Workout template not found.");
  }
  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "You don't have permission to modify this template.");
  }
  const week = template.weeks[0];
  if (!week) {
    throw new ApiError(404, "No week found in this template. This shouldn't happen.");
  }

  const dayExists = week.days.some((d) => d.day === day);
  if (dayExists) {
    throw new ApiError(400, `${day} already exists in this template.`);
  }

  const calculatedDayNumber = dayNumber || validDays.indexOf(day) + 1;
  const newDay = {
    day,
    dayNumber: calculatedDayNumber,
    isRestDay: isRestDay || false,
    workoutName: isRestDay ? "Rest Day" : (workoutName?.trim() || `${day} Workout`),
    exercises: [], // No exercises yet
    notes: notes?.trim() || "",
  };

  week.days.push(newDay);
  
  week.days.sort((a, b) => a.dayNumber - b.dayNumber);
  
  await template.save();

  return res.status(201).json(
    new ApiResponse(201, template, `${day} added successfully. Now you can add exercises to it.`)
  );
});

// 3. ADD EXERCISE TO A DAY
const addExerciseToDay = asyncHandler(async (req, res) => {
  const { templateId, dayId } = req.params;
  const { exerciseName, sets, reps, restTime, orderIndex, notes, videoUrl, muscleGroup } = req.body;
  const adminId = req.user._id;
  if (!exerciseName || sets === undefined || !reps || orderIndex === undefined) {
    throw new ApiError(400, "Exercise name, sets, reps, and order index are required.");
  }

  if (!Number.isInteger(sets) || sets < 1) {
    throw new ApiError(400, "Sets must be a positive integer.");
  }

  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    throw new ApiError(400, "Order index must be a non-negative integer.");
  }

  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Workout template not found.");
  }

  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "You don't have permission to modify this template.");
  }

  const week = template.weeks[0];
  if (!week) {
    throw new ApiError(404, "No week found in this template.");
  }

  const day = week.days.id(dayId);
  if (!day) {
    throw new ApiError(404, "Day not found.");
  }
  if (day.isRestDay) {
    throw new ApiError(400, "Cannot add exercises to a rest day.");
  }

  // Check for duplicate exercise name
  const exerciseExists = day.exercises.some(
    (ex) => ex.exerciseName.toLowerCase() === exerciseName.toLowerCase()
  );
  if (exerciseExists) {
    throw new ApiError(400, `Exercise "${exerciseName}" already exists in this day.`);
  }

  // Check for duplicate orderIndex
  const orderExists = day.exercises.some((ex) => ex.orderIndex === orderIndex);
  if (orderExists) {
    throw new ApiError(400, `Order index ${orderIndex} already exists. Please choose a different order.`);
  }

  // Create exercise
  const newExercise = {
    exerciseName: exerciseName.trim(),
    sets,
    reps: reps.toString().trim(),
    restTime: restTime || 60,
    orderIndex,
    notes: notes?.trim() || "",
    videoUrl: videoUrl?.trim() || "",
    muscleGroup: muscleGroup?.trim() || "",
  };

  // Add exercise to day
  day.exercises.push(newExercise);
  
  // Sort exercises by orderIndex
  day.exercises.sort((a, b) => a.orderIndex - b.orderIndex);

  await template.save();

  return res.status(201).json(
    new ApiResponse(201, template, `Exercise "${exerciseName}" added to ${day.day} successfully.`)
  );
});


// 4. GET SINGLE TEMPLATE
const getTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await WorkoutTemplate.findById(templateId)
    .populate("createdBy", "name email");
  
  if (!template) {
    throw new ApiError(404, "Workout template not found.");
  }

  return res.status(200).json(
    new ApiResponse(200, template, "Template retrieved successfully.")
  );
});

// 5. GET ALL ADMIN TEMPLATES
const getAdminTemplates = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

//   const templates = await WorkoutTemplate.find({ createdBy: adminId })
  const templates = await WorkoutTemplate.find({})
    .select("name description difficultyLevel goal duration weeks createdAt")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, templates, `Found ${templates.length} template(s).`)
  );
});

// 6. UPDATE EXERCISE
const updateExercise = asyncHandler(async (req, res) => {
  const { templateId, dayId, exerciseId } = req.params;
  const updates = req.body;
  const adminId = req.user._id;

  // Find template
  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Template not found.");
  }

  // Check permission
  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "Permission denied.");
  }

  const week = template.weeks[0];
  const day = week.days.id(dayId);
  if (!day) {
    throw new ApiError(404, "Day not found.");
  }

  const exercise = day.exercises.id(exerciseId);
  if (!exercise) {
    throw new ApiError(404, "Exercise not found.");
  }

  // Update fields
  if (updates.exerciseName) exercise.exerciseName = updates.exerciseName.trim();
  if (updates.sets !== undefined) exercise.sets = updates.sets;
  if (updates.reps) exercise.reps = updates.reps.toString().trim();
  if (updates.restTime !== undefined) exercise.restTime = updates.restTime;
  if (updates.orderIndex !== undefined) {
    // Check if new orderIndex conflicts with existing exercises
    const orderExists = day.exercises.some(
      ex => ex._id.toString() !== exerciseId && ex.orderIndex === updates.orderIndex
    );
    if (orderExists) {
      throw new ApiError(400, `Order index ${updates.orderIndex} already exists.`);
    }
    exercise.orderIndex = updates.orderIndex;
  }
  if (updates.notes) exercise.notes = updates.notes.trim();
  if (updates.videoUrl) exercise.videoUrl = updates.videoUrl.trim();
  if (updates.muscleGroup) exercise.muscleGroup = updates.muscleGroup.trim();

  // Re-sort exercises
  day.exercises.sort((a, b) => a.orderIndex - b.orderIndex);

  await template.save();

  return res.status(200).json(
    new ApiResponse(200, template, "Exercise updated successfully.")
  );
});

// 7. DELETE EXERCISE
const deleteExercise = asyncHandler(async (req, res) => {
  const { templateId, dayId, exerciseId } = req.params;
  const adminId = req.user._id;

  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Template not found.");
  }

  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "Permission denied.");
  }

  const week = template.weeks[0];
  const day = week.days.id(dayId);
  if (!day) {
    throw new ApiError(404, "Day not found.");
  }

  // Remove exercise
  day.exercises = day.exercises.filter(ex => ex._id.toString() !== exerciseId);
  
  // Reorder remaining exercises
  day.exercises.forEach((ex, index) => {
    ex.orderIndex = index + 1;
  });

  await template.save();

  return res.status(200).json(
    new ApiResponse(200, template, "Exercise deleted successfully.")
  );
});

// 8. DELETE DAY
const deleteDay = asyncHandler(async (req, res) => {
  const { templateId, dayId } = req.params;
  const adminId = req.user._id;

  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Template not found.");
  }

  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "Permission denied.");
  }

  const week = template.weeks[0];
  week.days = week.days.filter(day => day._id.toString() !== dayId);

  await template.save();

  return res.status(200).json(
    new ApiResponse(200, template, "Day deleted successfully.")
  );
});

// 9. DELETE TEMPLATE
const deleteTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const adminId = req.user._id;

  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Template not found.");
  }

  if (template.createdBy.toString() !== adminId.toString()) {
    throw new ApiError(403, "Permission denied.");
  }

  await template.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Template deleted successfully.")
  );
});

export {
  createWorkoutTemplate,
  addDayToTemplate,
  addExerciseToDay,
  getTemplate,
  getAdminTemplates,
  updateExercise,
  deleteExercise,
  deleteDay,
  deleteTemplate
};