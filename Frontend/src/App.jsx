import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

const App = () => {
  return (
    <div className="min-h-screen" data-theme="night">
      <SignedOut>
        <SignInButton mode="modal" />
      </SignedOut>

      <SignedIn>
        <SignedOut />
      </SignedIn>

      <UserButton />
    </div>
  );
};

export default App;
