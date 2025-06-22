import React, { useState } from 'react';
import './App.css';

function Upload() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.summary) {
        setSummary(data.summary);
      } else {
        alert(data.error || 'Something went wrong!');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload & Summarize</button>

      {loading && <p>⏳ Summarizing...</p>}

      {summary && (
        <div className="summary">
          <h2>📝 AI-Generated Notes:</h2>
          <pre>{summary}</pre>
        </div>
      )}
    </div>
  );
}

export default Upload;
