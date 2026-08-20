import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber:{
        type:Number,
        required:true,
        unique:true
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    refreshToken:{
        type:String
    },
    resetPasswordToken:{
      type:String
    },
    isSuperAdmin:{
      type:Boolean,
      default:false
    },
    // permissions starts here
    // if is not super admin then do apply more permissions
      members:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default: false
        }
      },
      payments:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      // for extra pages section of payments and payments in
      // for senario if 
                // payments.allow = true && payments_in.allow = true -> then full access for payments_in page
                // payments.allow = true && payments_in.allow = true && payments_in.readOnly = true -> then read only
                // (same for all_payments as well as cafe_payments)
      payments_in:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      all_payments:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      cafe_payments:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      cafe_all_items:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      cafe_admins:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type: Boolean,
          default:false
        }
      },
      trainer:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      attendance:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      plans:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      offers:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      // for now not including cafe
      supplement:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      sell_supplement:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      coupons:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      trainer_coupon:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      expense:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      assets:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        },
      },
      check_in_qr:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      workout_templates:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      can_assign_workout:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      can_renew:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      can_assign_diet:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      },
      can_change_trainer:{
        allow:{
          type: Boolean,
          default:false
        },
        isReadOnly:{
          type:Boolean,
          default: false
        }
      }
    },
  { timestamps: true }
);

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};


adminSchema.methods.generateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: "admin"
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};


adminSchema.methods.generateRefreshToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const Admin = mongoose.model("Admin", adminSchema);