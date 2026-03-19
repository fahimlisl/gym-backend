import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: [true, 'Exercise name is required']
  },
  sets: {
    type: Number,
    required: true,
    min: 1
  },
  reps: {
    type: String,
    required: true
  },
  restTime: {
    type: Number,
    default: 60
  },
  orderIndex: {
    type: Number,
    required: true
  },
  notes: String,
  videoUrl: String,
  muscleGroup: String
});

const dailyWorkoutSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  dayNumber: {
    type: Number, // 1-7 (Monday=1, Sunday=7)
    min: 1,
    max: 7
  },
  isRestDay: {
    type: Boolean,
    default: false
  },
  workoutName: String,
  exercises: [exerciseSchema],
  notes: String,
});

const workoutTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Weekly plan name is required'],
    trim: true
  },
  description: String,
  difficultyLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    required: true
  },
  goal: {
    type: String,
    enum: ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss', 'General Fitness'],
    default: 'General Fitness'
  },
  weeks: [{
    days: [dailyWorkoutSchema],
  }],
  duration: {
    type: Number, // Total weeks in plan
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
}, {
  timestamps: true
});

export const WorkoutTemplate = mongoose.model('WorkoutTemplate', workoutTemplateSchema);
