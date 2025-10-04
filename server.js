const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration - folder containing images and JSON files
const DATA_FOLDER = process.env.DATA_FOLDER || './data';

// Get list of all images in the folder
app.get('/api/images', (req, res) => {
    try {
        const files = fs.readdirSync(DATA_FOLDER);
        const images = files
            .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
            .map(file => {
                const imgId = path.parse(file).name;
                const jsonPath = path.join(DATA_FOLDER, `${imgId}.json`);
                return {
                    id: imgId,
                    imagePath: file,
                    hasJson: fs.existsSync(jsonPath)
                };
            })
            .filter(img => img.hasJson);
        
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific image
app.get('/api/image/:id', (req, res) => {
    try {
        const imgId = req.params.id;
        const files = fs.readdirSync(DATA_FOLDER);
        const imageFile = files.find(file => 
            path.parse(file).name === imgId && 
            (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
        );
        
        if (!imageFile) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        const imagePath = path.join(DATA_FOLDER, imageFile);
        res.sendFile(path.resolve(imagePath));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get JSON data for an image
app.get('/api/data/:id', (req, res) => {
    try {
        const imgId = req.params.id;
        const jsonPath = path.join(DATA_FOLDER, `${imgId}.json`);
        
        if (!fs.existsSync(jsonPath)) {
            return res.status(404).json({ error: 'JSON file not found' });
        }
        
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save JSON data for an image
app.post('/api/data/:id', (req, res) => {
    try {
        const imgId = req.params.id;
        const jsonPath = path.join(DATA_FOLDER, `${imgId}.json`);
        
        fs.writeFileSync(jsonPath, JSON.stringify(req.body, null, 4));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data folder: ${path.resolve(DATA_FOLDER)}`);
});
