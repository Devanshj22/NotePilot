import React from 'react';
import Upload from './Upload';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>NotePilot 📚</h1>
      <p>Upload your PDF and let AI generate study notes.</p>
      <Upload />
    </div>
  );
}

export default App;
