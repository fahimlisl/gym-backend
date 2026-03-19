import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { User } from "../models/user.models.js";
import { AssignedWorkout } from "../models/assignedWorkout.model.js";
import { WorkoutTemplate } from "../models/workout.template.models.js";

// 1. ASSIGN TEMPLATE TO USER
const assignWorkoutToUser = asyncHandler(async (req, res) => {
  const { userId, templateId, startDate } = req.body;
  const adminId = req.user._id;

  if (!userId || !templateId) {
    throw new ApiError(400, "User ID and Template ID are required.");
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Check if template exists
  const template = await WorkoutTemplate.findById(templateId);
  if (!template) {
    throw new ApiError(404, "Workout template not found.");
  }

  // Check if user already has an active workout plan
  const existingWorkout = await AssignedWorkout.findOne({
    user: userId,
    status: 'Active'
  });

  if (existingWorkout) {
    throw new ApiError(400, "User already has an active workout plan. Complete or pause it first.");
  }

  // Create weeks structure from template
  const weeks = [];
  for (let i = 0; i < template.duration; i++) {
    weeks.push({
      weekNumber: i + 1,
      weekName: `Week ${i + 1}`,
      days: JSON.parse(JSON.stringify(template.weeks[0].days)), // Deep copy days
      notes: ""
    });
  }

  // Create assigned workout
  const assignedWorkout = await AssignedWorkout.create({
    user: userId,
    template: templateId,
    name: template.name,
    description: template.description,
    difficultyLevel: template.difficultyLevel,
    goal: template.goal,
    startDate: startDate ? new Date(startDate) : new Date(),
    duration: template.duration,
    weeks,
    currentWeek: 1,
    status: 'Active'
  });

  if (!assignedWorkout) {
    throw new ApiError(500, "Failed to assign workout to user.");
  }

  await assignedWorkout.populate('user', 'username email');
  await assignedWorkout.populate('template', 'name description');

  return res.status(201).json(
    new ApiResponse(201, assignedWorkout, "Workout plan assigned successfully.")
  );
});

// 2. GET USER'S CURRENT WORKOUT
const getUserWorkout = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const workout = await AssignedWorkout.findOne({ user: userId, status: 'Active' })
    .populate('user', 'username email')
    .populate('template', 'name description');

  if (!workout) {
    return res.status(200).json(
      new ApiResponse(200, null, "User has no active workout plan.")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, workout, "Workout retrieved successfully.")
  );
});

// 3. UPDATE EXERCISE IN ASSIGNED WORKOUT
const updateExerciseInAssignedWorkout = asyncHandler(async (req, res) => {
  const { workoutId, weekNumber, dayId, exerciseId } = req.params;
  const updates = req.body;
  const adminId = req.user._id;

  // Find assigned workout
  const workout = await AssignedWorkout.findById(workoutId);
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }

  // Find week
  const week = workout.weeks.find(w => w.weekNumber === parseInt(weekNumber));
  if (!week) {
    throw new ApiError(404, "Week not found in this workout.");
  }

  // Find day
  const day = week.days.id(dayId);
  if (!day) {
    throw new ApiError(404, "Day not found in this week.");
  }

  // Find exercise
  const exercise = day.exercises.id(exerciseId);
  if (!exercise) {
    throw new ApiError(404, "Exercise not found in this day.");
  }

  // Update exercise fields
  if (updates.exerciseName) exercise.exerciseName = updates.exerciseName.trim();
  if (updates.sets !== undefined) exercise.sets = updates.sets;
  if (updates.reps !== undefined) exercise.reps = updates.reps.toString().trim();
  if (updates.restTime !== undefined) exercise.restTime = updates.restTime;
  if (updates.notes !== undefined) exercise.notes = updates.notes.trim();
  if (updates.videoUrl !== undefined) exercise.videoUrl = updates.videoUrl.trim();
  if (updates.muscleGroup !== undefined) exercise.muscleGroup = updates.muscleGroup.trim();

  await workout.save();

  return res.status(200).json(
    new ApiResponse(200, workout, "Exercise updated successfully.")
  );
});

// 4. UPDATE CURRENT WEEK
const updateCurrentWeek = asyncHandler(async (req, res) => {
  const { workoutId } = req.params;
  const { currentWeek } = req.body;

  if (currentWeek === undefined || !Number.isInteger(currentWeek) || currentWeek < 1) {
    throw new ApiError(400, "Current week must be a positive integer.");
  }

  const workout = await AssignedWorkout.findById(workoutId);
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }

  if (currentWeek > workout.duration) {
    throw new ApiError(400, `Current week cannot exceed workout duration (${workout.duration} weeks).`);
  }

  workout.currentWeek = currentWeek;
  await workout.save();

  return res.status(200).json(
    new ApiResponse(200, workout, "Current week updated successfully.")
  );
});

// 5. UPDATE WORKOUT STATUS
const updateWorkoutStatus = asyncHandler(async (req, res) => {
  const { workoutId } = req.params;
  const { status } = req.body;

  const validStatuses = ['Active', 'Completed', 'Paused'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${validStatuses.join(", ")}`);
  }

  const workout = await AssignedWorkout.findById(workoutId);
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }

  workout.status = status;
  await workout.save();

  return res.status(200).json(
    new ApiResponse(200, workout, `Workout status updated to ${status}.`)
  );
});

// 6. DELETE ASSIGNED WORKOUT
const deleteAssignedWorkout = asyncHandler(async (req, res) => {
  const { workoutId } = req.params;

  const workout = await AssignedWorkout.findById(workoutId);
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }

  await AssignedWorkout.findByIdAndDelete(workoutId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Assigned workout deleted successfully.")
  );
});

// 7. GET ALL ASSIGNED WORKOUTS (FOR ADMIN)
const getAllAssignedWorkouts = asyncHandler(async (req, res) => {
  const workouts = await AssignedWorkout.find()
    .populate('user', 'username email phoneNumber')
    .populate('template', 'name description')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, workouts, `Found ${workouts.length} assigned workout(s).`)
  );
});


const getSingleAssignedWorkout = asyncHandler(async (req, res) => {
  const { workoutId } = req.params;
 
  const workout = await AssignedWorkout.findById(workoutId)
    .populate('user', 'username email phoneNumber')
    .populate('template', 'name description difficultyLevel goal');
 
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }
 
  return res.status(200).json(
    new ApiResponse(200, workout, "Workout retrieved successfully.")
  );
});

const deleteExerciseFromAssignedWorkout = asyncHandler(async (req, res) => {
  const { workoutId, weekNumber, dayId, exerciseId } = req.params;
 
  // Find assigned workout
  const workout = await AssignedWorkout.findById(workoutId);
  if (!workout) {
    throw new ApiError(404, "Assigned workout not found.");
  }
 
  // Find week
  const week = workout.weeks.find(w => w.weekNumber === parseInt(weekNumber));
  if (!week) {
    throw new ApiError(404, "Week not found in this workout.");
  }
 
  // Find day
  const day = week.days.id(dayId);
  if (!day) {
    throw new ApiError(404, "Day not found in this week.");
  }
 
  // Remove exercise
  day.exercises = day.exercises.filter(ex => ex._id.toString() !== exerciseId);
 
  await workout.save();
 
  return res.status(200).json(
    new ApiResponse(200, workout, "Exercise deleted successfully.")
  );
});
 

const getUserAssignedWorkout = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const workout = await AssignedWorkout.findOne({ 
    user: userId, 
    status: 'Active' 
  })
    .populate('user', 'username email phoneNumber')
    .populate('template', 'name description difficultyLevel goal');

  if (!workout) {
    return res.status(200).json(
      new ApiResponse(200, null, "User has no active workout plan.")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, workout, "Workout retrieved successfully.")
  );
});


export {
  assignWorkoutToUser,
  getUserWorkout,
  updateExerciseInAssignedWorkout,
  updateCurrentWeek,
  updateWorkoutStatus,
  deleteAssignedWorkout,
  getAllAssignedWorkouts,
  getSingleAssignedWorkout,
  deleteExerciseFromAssignedWorkout,
  getUserAssignedWorkout
};