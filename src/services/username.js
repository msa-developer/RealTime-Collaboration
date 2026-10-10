/* Username passed between pages via sessionStorage
   (react-router's location.state has no Next.js equivalent). */
export const getUsername = () =>
  (typeof window !== "undefined" && sessionStorage.getItem("username")) ||
  "Anonymous";
