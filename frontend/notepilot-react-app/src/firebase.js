// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwzYIrPOQzztNCnGodltvkd5mpE2K3MOM",
  authDomain: "note-pilot.firebaseapp.com",
  projectId: "note-pilot",
  storageBucket: "note-pilot.firebasestorage.app",
  messagingSenderId: "337453221847",
  appId: "1:337453221847:web:be64d8bfbf75cd240fed92",
  measurementId: "G-2EF68R52JF"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export default app;