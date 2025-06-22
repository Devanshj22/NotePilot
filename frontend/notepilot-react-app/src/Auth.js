import React, { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

export default function AuthForm() {
  const [user_email, setEmail] = useState("");
  const [user_password, setPassword] = useState("");

  const signUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, user_email, user_password);
      alert("Signed up successfully!");
    } catch (error) {
      alert("Failed to meet requirements. Please try again.");
    }
  };

  const logIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, user_email, user_password);
      alert("Logged in successfully");
    } catch (error) {
      alert("Failed to Log in. Please try again.");
    }
  };

  return (
    <div className="auth-container" role="region" aria-label="Authentication form">
      <h2>Welcome to NotePilot</h2>
      <p className="auth-info">Sign up or login to save your notes</p>
      <input
        className="auth-input"
        type="email"
        placeholder="Random123@gmail.com"
        value={user_email}
        onChange={(event) => setEmail(event.target.value)}
        aria-label="Email"
      />
      <input
        className="auth-input"
        type="password"
        placeholder="Mypassword@1"
        value={user_password}
        onChange={(event) => setPassword(event.target.value)}
        aria-label="Password"
      />
      <div className="auth-button-group">
        <button className="auth-button" onClick={signUp} aria-label="Sign up">
          Sign Up
        </button>
        <button className="auth-button" onClick={logIn} aria-label="Log in">
          Log In
        </button>
      </div>
    </div>
  );
}
