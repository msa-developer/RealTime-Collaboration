import connectdb from "./db.js";
import User from "../models/User.js";
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "real-time-collaboration" });

const syncUser = inngest.createFunction(
  { id: "real-time" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectdb();
    const { id, first_name, email_address, last_name } = event.data;

    const newUser = {
      clerkId: id,
      email: email_address[0]?.email_address,
      name: `${first_name}`,
    };
    await User.create(newUser);
  },
);
