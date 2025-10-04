# OCR Field Localizer

A Node.js web application for annotating and managing OCR field bounding boxes in images.

## Features

- Display images with OCR bounding boxes
- Assign OCR boxes to specific fields by clicking
- Visual field selector with color-coded boxes
- Navigate between images (next/previous/jump to specific image)
- Save changes back to JSON files
- Display current image path

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Prepare your data folder with images and corresponding JSON files:
   - Images: `{img_id}.jpg` (or .png, .jpeg)
   - JSON files: `{img_id}.json`

2. JSON format should be:
```json
{
    "fields": {
        "field1": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]],
        "field2": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    },
    "ocr": [
        [[x1, y1], [x2, y2], [x3, y3], [x4, y4]],
        [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    ]
}
```

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

4. By default, the app looks for data in the `./data` folder. You can specify a different folder:
```bash
DATA_FOLDER=/path/to/your/data npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## How to Use

1. **Select a field** from the side panel
2. **Click on any OCR box** in the image to assign it to the selected field
3. The box will change color to match the field's color
4. Use **Next/Previous buttons** or the **dropdown** to navigate between images
5. Click **Save Changes** to persist your edits to the JSON file

## Project Structure

```
ocr-field-localizer/
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html     # Main HTML page
│   ├── styles.css     # Styling
│   └── app.js         # Frontend JavaScript
└── data/              # Your images and JSON files (create this folder)
```

## Requirements

- Node.js 14 or higher
- Modern web browser with HTML5 Canvas support
