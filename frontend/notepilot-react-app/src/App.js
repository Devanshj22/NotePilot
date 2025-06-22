import React, { useState, useRef, useEffect } from 'react';

// Auth Component
const Auth = ({ onAuthToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);

  const handleAuth = (type) => {
    if (email && password) {
      onAuthToggle(`${type === 'signup' ? 'Signed up' : 'Logged in'} successfully! Welcome to NotePilot.`);
    }
  };

  return (
    <div className="auth-section">
      <div className="auth-container">
        <h3>Access Your Summaries</h3>
        <p className="auth-subtitle">Sign up or log in to save your summaries for later</p>
        
        <div className="auth-form">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
          
          <div className="auth-buttons">
            <button 
              className="auth-btn signup-btn" 
              onClick={() => handleAuth('signup')}
            >
              Sign Up
            </button>
            <button 
              className="auth-btn login-btn" 
              onClick={() => handleAuth('login')}
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Upload Component
const Upload = ({ onSummaryGenerate, isGenerating }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setStatusMessage(`Selected: ${file.name}`);
    } else {
      setStatusMessage('Please select a valid PDF file');
      setSelectedFile(null);
    }
  };

  const handleGenerateSummary = () => {
    if (selectedFile) {
      onSummaryGenerate(selectedFile);
    } else {
      setStatusMessage('Please select a PDF file first');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setStatusMessage(`Selected: ${file.name}`);
    } else {
      setStatusMessage('Please drop a valid PDF file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="upload-section">
      <div className="upload-container">
        <h3>Upload Your PDF</h3>
        
        <div 
          className={`file-drop-zone ${selectedFile ? 'has-file' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">📄</div>
            {selectedFile ? (
              <div className="file-info">
                <p className="file-name">{selectedFile.name}</p>
                <p className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="upload-prompt">
                <p><strong>Click to upload</strong> or drag and drop</p>
                <p className="file-types">PDF files only</p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="file-input-hidden"
          />
        </div>

        <button 
          className={`generate-btn ${isGenerating ? 'generating' : ''}`}
          onClick={handleGenerateSummary}
          disabled={!selectedFile || isGenerating}
        >
          {isGenerating ? (
            <>
              <div className="spinner"></div>
              Generating Summary...
            </>
          ) : (
            'Generate Summary'
          )}
        </button>

        {statusMessage && (
          <div className={`status-message ${selectedFile ? 'success' : 'error'}`}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

// Summary Box Component
const SummaryBox = ({ summary, isVisible }) => {
  const summaryRef = useRef(null);

  useEffect(() => {
    if (isVisible && summaryRef.current) {
      summaryRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div ref={summaryRef} className="summary-section">
      <div className="summary-container">
        <h3>Your Summary</h3>
        <div className="summary-box">
          <div className="notebook-paper">
            <div className="red-line"></div>
            <div className="summary-content">
              {summary}
            </div>
          </div>
        </div>
        
        <div className="summary-actions">
          <button className="action-btn copy-btn" onClick={() => navigator.clipboard.writeText(summary)}>
            📋 Copy Summary
          </button>
          <button className="action-btn save-btn">
            💾 Save Summary
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [summary, setSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const handleSummaryGenerate = async (file) => {
    setIsGenerating(true);
    setShowSummary(false);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', '1'); // You can allow user to choose 1 or 2 formats
    
    try {
      // 1️⃣ Upload file
      const uploadResponse = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      });
      
      const uploadData = await uploadResponse.json();
      const sessionId = uploadData.session_id;
      
      // 2️⃣ Poll for status
      let processingDone = false;
      while (!processingDone) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(`http://localhost:8000/status/${sessionId}`);
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          // 3️⃣ Get generated summary text
          const textFile = await fetch(`http://localhost:8000/download/${sessionId}/txt`);
          const summaryText = await textFile.text();
          setSummary(summaryText);
          processingDone = true;
          setShowSummary(true);
        } else if (statusData.status === 'error') {
          alert("Processing failed: " + statusData.message);
          processingDone = true;
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong.');
    }
    
    setIsGenerating(false);
  };

  const handleAuthToggle = (message) => {
    setAuthMessage(message);
    setTimeout(() => setAuthMessage(''), 5000);
  };

  return (
    <div className="app">
      {/* Header Section */}
      <header className="header">
        <div className="container">
          <div className="hero-content">
            <h1 className="app-title">
              <span className="title-icon">🚀</span>
              NotePilot
            </h1>
            <p className="app-subtitle">Summarize your PDFs with the power of AI</p>
            
            {authMessage && (
              <div className="auth-success-message">
                {authMessage}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          <Auth onAuthToggle={handleAuthToggle} />
          <Upload 
            onSummaryGenerate={handleSummaryGenerate} 
            isGenerating={isGenerating}
          />
          <SummaryBox 
            summary={summary} 
            isVisible={showSummary}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>Made with ❤️ by Devansh,Harveer,Shrey,Satnam</p>
          <a href="https://github.https://github.com/Devanshj22/NotePilot" className="github-link">
            View on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

// CSS Styles
const styles = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Fira+Code:wght@300;400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Space Grotesk', monospace;
  background: 
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 99, 132, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(54, 215, 183, 0.3) 0%, transparent 50%),
    linear-gradient(-45deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f0f23 75%, #0a0a0a 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 400% 400%;
  background-attachment: fixed;
  animation: gradientShift 15s ease infinite;
  color: #e2e8f0;
  line-height: 1.6;
  min-height: 100vh;
  overflow-x: hidden;
}

@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 50%, 0% 50%, 0% 50%, 0% 50%;
  }
  25% {
    background-position: 100% 50%, 25% 25%, 75% 75%, 25% 75%;
  }
  50% {
    background-position: 50% 100%, 75% 50%, 25% 25%, 50% 0%;
  }
  75% {
    background-position: 0% 0%, 50% 75%, 100% 50%, 75% 25%;
  }
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.app::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 98px,
      rgba(120, 119, 198, 0.03) 100px,
      rgba(120, 119, 198, 0.03) 102px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 98px,
      rgba(120, 119, 198, 0.03) 100px,
      rgba(120, 119, 198, 0.03) 102px
    );
  pointer-events: none;
  z-index: 1;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  position: relative;
  z-index: 2;
}

/* Header Styles */
.header {
  background: rgba(15, 15, 35, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(120, 119, 198, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  animation: slideDownGlow 1.2s cubic-bezier(0.23, 1, 0.320, 1);
}

@keyframes slideDownGlow {
  0% {
    transform: translateY(-100%) rotateX(-90deg);
    opacity: 0;
    filter: blur(10px);
  }
  50% {
    transform: translateY(-20px) rotateX(-20deg);
    opacity: 0.8;
  }
  100% {
    transform: translateY(0) rotateX(0deg);
    opacity: 1;
    filter: blur(0px);
  }
}

.hero-content {
  text-align: center;
  padding: 60px 0;
  position: relative;
}

.hero-content::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(120, 119, 198, 0.1) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: pulse 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.8;
  }
}

.app-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 700;
  background: linear-gradient(
    135deg,
    #7877c6 0%,
    #36d7b7 25%,
    #ff6384 50%,
    #7877c6 75%,
    #36d7b7 100%
  );
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  animation: 
    fadeInUpBounce 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both,
    gradientFlow 8s ease-in-out infinite;
  text-shadow: 0 0 40px rgba(120, 119, 198, 0.5);
  position: relative;
}

.app-title::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #7877c6, #36d7b7, #ff6384);
  background-size: 400% 400%;
  animation: gradientFlow 8s ease-in-out infinite;
  filter: blur(20px);
  opacity: 0.3;
  z-index: -1;
}

@keyframes gradientFlow {
  0%, 100% {
    background-position: 0% 50%;
  }
  25% {
    background-position: 100% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
  75% {
    background-position: 0% 100%;
  }
}

.title-icon {
  font-size: 0.7em;
  animation: 
    bounce3D 2s ease-in-out infinite,
    colorShift 6s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(120, 119, 198, 0.8));
  transform-style: preserve-3d;
}

@keyframes bounce3D {
  0%, 100% {
    transform: translateY(0) rotateY(0deg) rotateX(0deg);
  }
  25% {
    transform: translateY(-15px) rotateY(90deg) rotateX(15deg);
  }
  50% {
    transform: translateY(-25px) rotateY(180deg) rotateX(0deg);
  }
  75% {
    transform: translateY(-15px) rotateY(270deg) rotateX(-15deg);
  }
}

@keyframes colorShift {
  0%, 100% { filter: drop-shadow(0 0 20px rgba(120, 119, 198, 0.8)) hue-rotate(0deg); }
  33% { filter: drop-shadow(0 0 20px rgba(54, 215, 183, 0.8)) hue-rotate(120deg); }
  66% { filter: drop-shadow(0 0 20px rgba(255, 99, 132, 0.8)) hue-rotate(240deg); }
}

.app-subtitle {
  font-family: 'Fira Code', monospace;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  color: #94a3b8;
  font-weight: 400;
  animation: fadeInUpBounce 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.5s both;
  position: relative;
  overflow: hidden;
}

.app-subtitle::before {
  content: '> ';
  color: #36d7b7;
  font-weight: 700;
  animation: blink 1.5s infinite;
}

.app-subtitle::after {
  content: '_';
  color: #36d7b7;
  animation: blink 1s infinite;
  margin-left: 4px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes fadeInUpBounce {
  0% {
    opacity: 0;
    transform: translateY(50px) rotateX(-45deg);
  }
  60% {
    opacity: 0.8;
    transform: translateY(-10px) rotateX(10deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}

.auth-success-message {
  background: linear-gradient(135deg, #36d7b7, #7877c6);
  color: #ffffff;
  padding: 16px 32px;
  border-radius: 50px;
  margin-top: 30px;
  display: inline-block;
  animation: 
    slideInGlow 0.8s cubic-bezier(0.23, 1, 0.320, 1),
    floatAnimation 3s ease-in-out infinite 0.8s;
  box-shadow: 
    0 8px 32px rgba(54, 215, 183, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  letter-spacing: 0.5px;
}

@keyframes slideInGlow {
  0% {
    transform: translateX(-100%) scale(0.5);
    opacity: 0;
    filter: blur(10px);
  }
  60% {
    transform: translateX(10px) scale(1.05);
    opacity: 0.9;
    filter: blur(2px);
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
    filter: blur(0px);
  }
}

@keyframes floatAnimation {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-5px);
  }
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 60px 0;
  position: relative;
}

/* Auth Section */
.auth-section {
  margin-bottom: 80px;
  animation: fadeInUpRotate 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.8s both;
}

@keyframes fadeInUpRotate {
  0% {
    opacity: 0;
    transform: translateY(60px) rotateX(-15deg) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0deg) scale(1);
  }
}

.auth-container {
  background: rgba(15, 15, 35, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-radius: 24px;
  padding: 50px;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(120, 119, 198, 0.2);
  text-align: center;
  border: 1px solid rgba(120, 119, 198, 0.3);
  position: relative;
  overflow: hidden;
}

.auth-container::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(120, 119, 198, 0.1) 90deg,
    transparent 180deg,
    rgba(54, 215, 183, 0.1) 270deg,
    transparent 360deg
  );
  animation: rotateBorder 15s linear infinite;
  pointer-events: none;
}

@keyframes rotateBorder {
  to {
    transform: rotate(360deg);
  }
}

.auth-container h3 {
  font-family: 'JetBrains Mono', monospace;
  color: #36d7b7;
  font-size: 2.2rem;
  margin-bottom: 15px;
  font-weight: 700;
  text-shadow: 0 0 20px rgba(54, 215, 183, 0.5);
  animation: glitchText 3s ease-in-out infinite;
  position: relative;
}

@keyframes glitchText {
  0%, 90%, 100% {
    transform: translateX(0);
  }
  92% {
    transform: translateX(-2px);
  }
  94% {
    transform: translateX(2px);
  }
  96% {
    transform: translateX(-1px);
  }
  98% {
    transform: translateX(1px);
  }
}

.auth-subtitle {
  color: #94a3b8;
  margin-bottom: 40px;
  font-size: 1.1rem;
  font-family: 'Fira Code', monospace;
  font-weight: 400;
}

.auth-form {
  max-width: 450px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.auth-input {
  width: 100%;
  padding: 18px 24px;
  margin-bottom: 20px;
  border: 2px solid rgba(120, 119, 198, 0.3);
  border-radius: 16px;
  font-size: 1.1rem;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
  background: rgba(15, 15, 35, 0.6);
  color: #e2e8f0;
  backdrop-filter: blur(10px);
  box-shadow: 
    inset 0 2px 10px rgba(0, 0, 0, 0.3),
    0 0 0 0 rgba(120, 119, 198, 0.5);
  position: relative;
}

.auth-input::placeholder {
  color: #64748b;
  font-family: 'Fira Code', monospace;
}

.auth-input:focus {
  outline: none;
  border-color: #36d7b7;
  box-shadow: 
    inset 0 2px 10px rgba(0, 0, 0, 0.3),
    0 0 0 4px rgba(54, 215, 183, 0.2),
    0 0 20px rgba(54, 215, 183, 0.4);
  transform: translateY(-3px) scale(1.02);
  background: rgba(15, 15, 35, 0.8);
}

.auth-input:hover {
  border-color: rgba(120, 119, 198, 0.6);
  transform: translateY(-1px);
}

.auth-buttons {
  display: flex;
  gap: 20px;
  margin-top: 30px;
}

.auth-btn {
  flex: 1;
  padding: 18px 36px;
  border: none;
  border-radius: 16px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
  font-family: 'JetBrains Mono', monospace;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.auth-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.6s;
}

.auth-btn:hover::before {
  left: 100%;
}

.signup-btn {
  background: linear-gradient(135deg, #36d7b7, #7877c6);
  color: #ffffff;
  box-shadow: 
    0 8px 24px rgba(54, 215, 183, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.signup-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 
    0 12px 32px rgba(54, 215, 183, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  filter: brightness(1.1);
}

.signup-btn:active {
  transform: translateY(-2px) scale(1.02);
}

.login-btn {
  background: rgba(15, 15, 35, 0.8);
  color: #7877c6;
  border: 2px solid #7877c6;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 8px 24px rgba(120, 119, 198, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.login-btn:hover {
  background: linear-gradient(135deg, #7877c6, #36d7b7);
  color: #ffffff;
  transform: translateY(-4px) scale(1.05);
  box-shadow: 
    0 12px 32px rgba(120, 119, 198, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border-color: transparent;
}

/* Upload Section */
.upload-section {
  margin-bottom: 50px;
  animation: fadeInUp 1s ease-out 0.8s both;
}

.upload-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
  border: 1px solid rgba(74, 117, 243, 0.1);
}

.upload-container h3 {
  color: #4a75f3;
  font-size: 1.8rem;
  margin-bottom: 30px;
  font-weight: 600;
}

.file-drop-zone {
  border: 3px dashed #8ab4f8;
  border-radius: 20px;
  padding: 60px 40px;
  margin-bottom: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(245, 247, 250, 0.5);
  position: relative;
  overflow: hidden;
}

.file-drop-zone:hover {
  border-color: #4a75f3;
  background: rgba(74, 117, 243, 0.05);
  transform: translateY(-2px);
}

.file-drop-zone.has-file {
  border-color: #4a75f3;
  background: rgba(74, 117, 243, 0.05);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.upload-icon {
  font-size: 3rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.file-info {
  text-align: center;
}

.file-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #4a75f3;
  margin-bottom: 5px;
}

.file-size {
  color: #666;
  font-size: 0.9rem;
}

.upload-prompt strong {
  color: #4a75f3;
  font-size: 1.1rem;
}

.file-types {
  color: #666;
  font-size: 0.9rem;
  margin-top: 5px;
}

.file-input-hidden {
  display: none;
}

.generate-btn {
  background: linear-gradient(135deg, #4a75f3, #8ab4f8);
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(74, 117, 243, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(74, 117, 243, 0.4);
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.generate-btn.generating {
  pointer-events: none;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-message {
  margin-top: 20px;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
}

.status-message.success {
  background: rgba(74, 117, 243, 0.1);
  color: #4a75f3;
  border: 1px solid rgba(74, 117, 243, 0.2);
}

.status-message.error {
  background: rgba(255, 99, 99, 0.1);
  color: #ff6363;
  border: 1px solid rgba(255, 99, 99, 0.2);
}

/* Summary Section */
.summary-section {
  animation: fadeInUp 1s ease-out;
}

.summary-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(74, 117, 243, 0.1);
}

.summary-container h3 {
  color: #4a75f3;
  font-size: 1.8rem;
  margin-bottom: 20px;
  font-weight: 600;
  text-align: center;
}

.summary-box {
  position: relative;
  margin-bottom: 30px;
}

.notebook-paper {
  background: #fefefe;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  position: relative;
  min-height: 300px;
  background-image: 
    linear-gradient(to bottom, transparent 39px, #e1e8ed 39px, #e1e8ed 41px, transparent 41px),
    linear-gradient(to right, transparent 79px, #ff6b6b 79px, #ff6b6b 81px, transparent 81px);
  background-size: 100% 40px, 100% 100%;
  background-repeat: repeat-y, no-repeat;
}

.red-line {
  position: absolute;
  left: 80px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff6b6b;
}

.summary-content {
  font-family: 'Caveat', cursive;
  font-size: 1.2rem;
  line-height: 1.8;
  color: #2c3e50;
  font-weight: 500;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-left: 20px;
  animation: typeWriter 0.8s ease-out;
}

@keyframes typeWriter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.summary-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  background: rgba(74, 117, 243, 0.1);
  color: #4a75f3;
  border: 1px solid rgba(74, 117, 243, 0.2);
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Inter', sans-serif;
}

.action-btn:hover {
  background: #4a75f3;
  color: white;
  transform: translateY(-2px);
}

/* Footer */
.footer {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  text-align: center;
  padding: 30px 0;
  color: #666;
  border-top: 1px solid rgba(74, 117, 243, 0.1);
}

.footer p {
  margin-bottom: 10px;
}

.github-link {
  color: #4a75f3;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.github-link:hover {
  text-decoration: underline;
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }
  
  .auth-container,
  .upload-container,
  .summary-container {
    padding: 25px;
    margin-bottom: 30px;
  }
  
  .file-drop-zone {
    padding: 40px 20px;
  }
  
  .auth-buttons {
    flex-direction: column;
  }
  
  .notebook-paper {
    padding: 25px;
    margin-left: 0;
  }
  
  .summary-content {
    font-size: 1.1rem;
    margin-left: 10px;
  }
  
  .summary-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .action-btn {
    width: 100%;
    max-width: 250px;
  }
}

@media (max-width: 480px) {
  .hero-content {
    padding: 30px 0;
  }
  
  .app-title {
    flex-direction: column;
    gap: 10px;
  }
  
  .auth-container,
  .upload-container,
  .summary-container {
    padding: 20px;
  }
  
  .file-drop-zone {
    padding: 30px 15px;
  }
  
  .notebook-paper {
    padding: 20px;
    background-size: 100% 35px, 100% 100%;
  }
  
  .summary-content {
    font-size: 1rem;
    line-height: 1.6;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default App;
