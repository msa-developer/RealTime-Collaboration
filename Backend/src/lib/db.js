import mongoose from "mongoose";

const connectdb = async () => {
  try {
    await mongoose
      .connect(process.env.mongodb)
      .then(() => console.log("connected to mongodb"));
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

export default connectdb;
