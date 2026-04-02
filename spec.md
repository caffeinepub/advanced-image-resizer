# Advanced Image Resizer

## Current State
New project. Empty Motoko backend scaffold only.

## Requested Changes (Diff)

### Add
- Image upload and preview (original image with size and dimension metadata)
- Width/height inputs with aspect ratio lock that auto-adjusts the other dimension
- Target size (KB) input for JPEG/WEBP/PNG output compression
- Format selector: JPEG, WEBP, PNG, PDF
- PDF quality slider (1–100) that shows only when PDF format is selected
- Resize/process logic using HTML Canvas API:
  - JPEG/WEBP: iteratively reduce quality until target size is met
  - PNG: iteratively scale down dimensions until target size is met
  - PDF: use jsPDF library to embed image at selected quality
- Resized output panel showing preview image (or PDF size info), dimensions, file size, and download button
- Loading overlay while processing
- Fully responsive layout (3-column desktop, stacked mobile)

### Modify
N/A (new project)

### Remove
N/A (new project)

## Implementation Plan
1. Backend: minimal Motoko actor (no persistent data needed — all processing is client-side)
2. Frontend:
   - Single-page app with 3-column layout: Settings | Original Preview | Resized Output
   - React state for all form inputs and image data
   - Canvas-based image processing entirely in the browser
   - jsPDF library via npm for PDF generation
   - Responsive CSS with mobile stacking
   - Loading spinner overlay during processing
