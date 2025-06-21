import React from 'react';
import Upload from './Upload';

function App() {
  return (
    <div className="App" style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>📘 NotePilot</h1>
      <p>Upload your PDF notes, slides, or textbooks — and get instant AI-generated summaries.</p>
      <Upload />
    </div>
  );
}

export default App;

