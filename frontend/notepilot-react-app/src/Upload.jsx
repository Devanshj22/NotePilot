import React, { useState } from 'react';

function Upload() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("Upload failed:", err);
    }

    setLoading(false);
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload PDF</button>

      {loading && <p>Generating notes…</p>}
      {summary && (
        <div>
          <h3>AI-Generated Notes:</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{summary}</pre>
        </div>
      )}
    </div>
  );
}

export default Upload;
