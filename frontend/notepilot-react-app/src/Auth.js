import React, { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

export default function AuthForm() {
    const[user_email, setEmail] = useState("")
    const[user_password, setPassword] = useState("")
    const signUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, user_email, user_password);
      alert("Signed up successfully!");
    } 
    catch(error){
      alert("Failed to meet requirements. Please try again.");
    }
  }
    const logIn = async()=>{
        try{
            await signInWithEmailAndPassword(auth,user_email, user_password);
            alert("Logged in successfully");
        }
        catch(error){
            alert("Failed to Log in. Please try again.")
        } 
    }


    return(
        <div>
            <input
                type="email"
                placeholder="Random123@gmail.com"
                value={user_email}
                onChange={(event)=>setEmail(event.target.value)}
            />
            <br />

            <input
                type="password"
                placeholder="Mypassword@1"
                value={user_password}
                onChange={(event)=>setPassword(event.target.value)}
            />
            <br />

            <button onClick={signUp}>Sign Up</button>
            <button onClick={logIn}>Log In</button>

        </div>
    )
};
