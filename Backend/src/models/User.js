import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profilePic: {
      type: String,
      default: "",
    },
    clerkId: {
      type: String,
      unique: true,
      required: true,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("user", userSchema);
export default User;
