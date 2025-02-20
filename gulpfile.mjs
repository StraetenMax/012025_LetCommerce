import gulp from 'gulp';
import pug from 'gulp-pug';
import JSON5 from 'json5';
import mjml from 'mjml';
import { minify as htmlmin } from 'html-minifier-terser';
import rename from 'gulp-rename';
import clean from 'gulp-clean';
import through2 from 'through2';
//-import htmlhint from 'gulp-htmlhint';
import { load } from 'cheerio';
import filesize from 'gulp-filesize';
import imagemin from 'gulp-imagemin';
import gifsicle from 'imagemin-gifsicle';
import mozjpeg from 'imagemin-mozjpeg';
import optipng from 'imagemin-optipng';
import liveServer from 'live-server';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs'; // Ajouté pour lire le fichier JSON
//import loadConfigs from './path-to-your-config-loader.mjs'; // Assurez-vous que ce chemin est correct
//-import { mkdir } from 'fs/promises'; // Pour créer des répertoires

// Définit --dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction asynchrone pour charger les configurations JSON5
const loadConfigs = async () => {
  try {
    const dataPartenaires = JSON5.parse(await fs.readFile('./src/includes/dataPartenaires.json5', 'utf8'));
    const mjmlConfig = JSON5.parse(await fs.readFile('.mjmlConfig.json5', 'utf8'));
    return {dataPartenaires, mjmlConfig };
  } catch (error) {
    console.error('Error loading configs:', error);
    console.error(`Failed to load configurations from ${filePath}:`, error);
    throw new Error('Failed to load configurations');
  }
};

// Tâche pour supprimer les attributs style
const removeEmptyStyles = () => {
    return through2.obj((file, _, cb) => {
      if (file.isBuffer()) {
        const $ = load(file.contents.toString());
        $('[style=""]').removeAttr('style'); // Supprimer les attributs style vides
        file.contents = Buffer.from($.html());
      }
      cb(null, file);
    });
  };

// Assurez-vous que le répertoire 'dist' existe
const ensureDistDirectory = async () => {
    try {
        await fs.mkdir('./dist', { recursive: true });
        console.log('Directory "dist" created or already exists.');
    } catch (error) {
        console.error('Error creating directory "dist":', error);
    }
};

// Serveur
const serve = (done) => {
    const params = {
        port: 8080,
        root: path.resolve(__dirname, './dist'),
        open: true,
        file: 'index.html',
        wait: 500,
        logLevel: 2, //Niveau de journalisation (0 = désactivé, 1 = erreurs, 2 = infos, 3 = debogage )
    };
    try {
        liveServer.start(params);
        console.log('Live Server started on port', params.port);
    } catch (error){
        console.error('Error starting Live Server:', error);
    }
    done();
};

// Compression des images
const compressImg = () => {
    return gulp.src('./src/images/*.{png,jpg,gif}')
        .pipe(filesize({ title: 'Taille des images avant compression' }))
        .pipe(imagemin([
            gifsicle({ interlaced: true, optimizationLevel: 3 }),
            mozjpeg({ quality: 75, progressive: true }),
            optipng({ optimizationLevel: 5 }),
        ]))
        .pipe(filesize({ title: 'Taille des images après compression' }))
        .pipe(gulp.dest('./dist/images'));
};

// Nettoyage
const cleanDist = () => {
    return gulp.src('./dist', { allowEmpty: true, read: false })
        .pipe(clean());
};

// Pug vers Mjml
const pugToMjml = async () => {
    const data = await loadConfigs();
    const dataPartenaires = data.dataPartenaires;
    // Vérifiez que dataHotellerie est bien définie
    if (!dataPartenaires) {
        throw new Error('dataParenaires is not defined. Check the loadConfigs function.');
    }
    console.log('Data loaded:', dataPartenaires);
    // Déclarez vos listes de logos ici
    const logosList1 = dataPartenaires.logosList1 || [];
    const logosList2 = dataPartenaires.logosList2 || [];
    const logosList3 = dataPartenaires.logosList3 || [];
    const logosList4 = dataPartenaires.logosList4 || [];
    return gulp.src('./src/*.pug')
        .pipe(pug({
            locals: {
                logosList1,
                logosList2,
                logosList3,
                logosList4,
                ...dataPartenaires // Passez les données JSON au template Pug
            },
            pretty: true, // À retirer pour la production
            debug: false, // À retirer pour la production
            compileDebug: false,
            globals: [],
            self: false,
        }))
        .pipe(rename({ extname: '.mjml' }))
        .pipe(gulp.dest('./src/mjml'));
};

// Mjml vers HTML
const mjmlToHtml = async () => {
    const config = await loadConfigs();
    return gulp.src('./src/mjml/*.mjml')
    .pipe(through2.obj((file, _, cb) => {
        try {
            const mjmlContent = file.contents.toString();
            const result = mjml(mjmlContent, {
                ...config.mjmlOptions,
                filePath: file.path // Ajout du chemin du fichier pour les imports relatifs
            });
            
            if (result.errors && result.errors.length) {
                console.error('MJML Errors:', result.errors);
                return cb(new Error('MJML compilation failed'));
            }
            
            file.contents = Buffer.from(result.html);
            cb(null, file);
        } catch (error) {
            console.error('Erreur dans le fichier:', file.path);
            console.error(error.message);
            cb(error);
        }
    }))
    .pipe(rename({ extname: '.html' }))
    .pipe(removeEmptyStyles())
    .pipe(gulp.dest('./dist'));
};

// Minification HTML----------------------------------------------------------------------------------------------------------------------
const minifyHtml = () => {
    return new Promise((resolve) => {
        // Petit délai pour s'assurer que les fichiers sont bien créés
        setTimeout(() => {
            console.log('Starting minifyHtml task...');
            gulp.src(['./dist/*.html', '!./dist/*.min.html'])
                .pipe(through2.obj(async (file, enc, callback) => {
                    if (file.isBuffer()) {
                        try {
                            const minified = await htmlmin(String(file.contents), {
                                collapseWhitespace: true,
                                removeComments: false, // On garde false pour les commentaires conditionnels
                                removeEmptyAttributes: true,
                                minifyCSS: true,
                                conservativeCollapse: false, // Changé à false pour minifier plus agressivement
                                preserveLineBreaks: false, // Changé à false pour supprimer les sauts de ligne
                                processConditionalComments: true, // Changé à true pour traiter les commentaires conditionnels
                                minifyJS: true,
                                caseSensitive: true, // Important pour les éléments MSO
                                keepClosingSlash: true, // Important pour la compatibilité email
                                html5: false // Important pour la compatibilité email
                            });
                            file.contents = Buffer.from(minified);
                            //console.log(`Minified file: ${file.path}`);
                        } catch (error) {
                            console.error(`Error minifying file: ${file.path}`, error);
                        }
                    } else {
                        console.warn(`File is not a buffer: ${file.path}`);
                    }
                    callback(null, file);
                }))
                .pipe(rename({ suffix: '.min' }))
                .pipe(gulp.dest('dist'))
                .on('end', () => {
                    console.log('minifyHtml task completed.');
                    resolve();
                });
        }, 500); // Délai de 500ms
    });
};

// Vérification du poids et des attributs alt--------------------------------------------------------------------------------
const customFilesize = () => {
    return through2.obj(function (file, _, cb) {
        if (file.isBuffer()) {
            const fileSizeInKB = file.contents.length / 1024;
            const fileName = path.basename(file.path);
            console.log(`${fileName}: ${fileSizeInKB.toFixed(2)} Ko`);
        } else {
            console.warn(`File is not a buffer: ${file.path}`);
        }
        cb(null, file);
    });
};

const verification = () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('Starting verification task...');
            gulp.src('dist/*.html')
                .pipe(customFilesize())
                .pipe(gulp.dest('dist'))
                .on('end', () => {
                    console.log('verification task completed.');
                    resolve();
                });
        }, 500); // Délai de 500ms
    });
};



// Watch ------------------------------------------------------------------------------------------------------------------------------
const watch = () => {
    gulp.watch('./src/**/*.pug', gulp.series(pugToMjml, mjmlToHtml, minifyHtml, verification,));
    gulp.watch('./src/images/**/*', gulp.series(compressImg));
};

// Tâche par défaut---------------------------------------------------------------------------------------------------------------------
const defaultTask = gulp.series(
    cleanDist,
    ensureDistDirectory, // Ajoutez cette tâche ici
    gulp.parallel(compressImg),
    pugToMjml,
    mjmlToHtml, // Appeler mjmlToHtml comme une fonction asynchrone
    (done) => {
        setTimeout(() => {
            gulp.series(minifyHtml, verification, serve, watch)(done);
        }, 500);
    }
);

// Export des tâches
export { serve, verification, compressImg, cleanDist, pugToMjml, mjmlToHtml, minifyHtml, watch, defaultTask as default };