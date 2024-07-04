const express = require('express');
const { exec } = require('child_process');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Créer le dossier commun 'cloner' s'il n'existe pas
const mainFolder = 'cloner';
if (!fs.existsSync(mainFolder)) {
    fs.mkdirSync(mainFolder);
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/download-and-zip', (req, res) => {
    const url = req.body.url;
    const userId = req.body.userId; // Identifiant unique de l'utilisateur
    const userFolder = path.join(mainFolder, `cloner_${userId}`);
    const zipFileName = `cloner_${userId}.zip`;

    // Créer un dossier unique pour l'utilisateur
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder);
    }

    // Commande wget pour télécharger le site en ignorant robots.txt
    const wgetCommand = `wget -r -l1 -H -nd -A php,html,css,js,gif,jpg -p -k -e robots=off -P ${userFolder} '${url}'`;

    exec(wgetCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send('Error during download and zip process. Please try again.');
        }

        // Création du fichier ZIP
        const output = fs.createWriteStream(path.join(__dirname, zipFileName));
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        output.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            res.download(path.join(__dirname, zipFileName), zipFileName, () => {
                // Suppression des fichiers et dossiers après 1 minute
                setTimeout(() => {
                    fs.rmdirSync(userFolder, { recursive: true });
                    fs.unlinkSync(path.join(__dirname, zipFileName));
                }, 60000); // 60000 ms = 1 minute
            });
        });

        archive.on('error', function(err){
            console.error(`archiver error: ${err}`);
            return res.status(500).send('Error during download and zip process. Please try again.');
        });

        archive.pipe(output);

        archive.directory(userFolder, false);

        archive.finalize();
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
