import mongoose from "mongoose";

const cafeItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  category: {
    // type: mongoose.Schema.Types.ObjectId,
    // ref: "CafeCategory",
    type:String,
    enum:["protien shake","coffee","energy drink"], // add more and more as per requirements
    required: true,
  },

  description:{ 
    type: String
  },

  price: {
    type: Number,
    required: true,
  },

  calories: {
    type:Number
},

  macros: {
    protein: Number, // grams
    carbs: Number,
    fats: Number,
  },

  isVeg: {
    type: Boolean,
    default: true
  },

  image: {
    url: String,
    public_id: String
  },

  available: {
    type: Boolean,
    default: true
  },

  tags: [ // can use this as a normal field only
    {
      type: String, // "high-protein", "fat-loss", "bulking"
    }
  ]
}, { timestamps: true });

export const CafeItem = mongoose.model("CafeItem", cafeItemSchema);
