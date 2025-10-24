const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');

const UPLOADS_DIR = path.join(__dirname,'uploads');
fs.ensureDirSync(UPLOADS_DIR);

function setupFileUpload(app) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
    });
    const upload = multer({ storage });

    app.post('/upload', upload.single('file'), (req,res)=>{
        if(!req.file) return res.status(400).json({error:'No file uploaded'});
        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: `/uploads/${req.file.filename}`
        });
    });
}

module.exports = { setupFileUpload };

