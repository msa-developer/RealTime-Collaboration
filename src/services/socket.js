import { io } from "socket.io-client";

/* null during SSR — components only use it in effects/handlers */
const socket = typeof window !== "undefined" ? io() : null;

export default socket;
