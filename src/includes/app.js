const fs = require('fs');
const path = require('path');
const pug = require('pug');

// Lire le fichier JSON
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataPartenaires.json5'), 'utf8'));

// Compiler le template Pug avec les données JSON
const compiledFunction = pug.compileFile(path.join(__dirname, '_partenaires.pug'));
const htmlOutput = compiledFunction({logosList1: data.logosList1, logosList2: data.logosList2, logosList3: data.logosList3, logosList4: data.logosList4});

// Afficher le Html généré
console.log(htmlOutput);