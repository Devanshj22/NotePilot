async function uploadPDF() {
  const fileInput = document.getElementById('pdfInput');
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a PDF file.");
    return;
  }

  document.getElementById('loading').style.display = 'block';
  document.getElementById('resultContainer').style.display = 'none';

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await fetch('http://localhost:5000/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    document.getElementById('summaryOutput').textContent = data.summary;
    document.getElementById('resultContainer').style.display = 'block';
  } catch (error) {
    alert('An error occurred while uploading.');
    console.error(error);
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}
