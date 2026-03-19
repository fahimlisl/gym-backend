import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
  exerciseName: String,
  sets: Number,
  reps: String,
  restTime: Number,
  orderIndex: Number,
  notes: String,
  videoUrl: String,
  muscleGroup: String
});

const dailyWorkoutSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  dayNumber: {
    type: Number,
    min: 1,
    max: 7
  },
  isRestDay: {
    type: Boolean,
    default: false
  },
  workoutName: String,
  exercises: [exerciseSchema],
  notes: String
}, {
  timestamps: false
});

const assignedWorkoutSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutTemplate',
    required: true
  },

  name: String,
  description: String,
  difficultyLevel: String,
  goal: String,

  startDate: {
    type: Date,
    required: true
  },

  duration: Number,

  weeks: [{
    weekNumber: Number,
    weekName: String,
    days: [dailyWorkoutSchema],
    notes: String
  }],

  currentWeek: {
    type: Number,
    default: 1
  },

  status: {
    type: String,
    enum: ['Active', 'Completed', 'Paused'],
    default: 'Active'
  }

}, {
  timestamps: true
});

export const AssignedWorkout = mongoose.model('AssignedWorkout', assignedWorkoutSchema);