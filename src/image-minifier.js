import imagemin from 'gulp-imagemin';
import sharp from 'sharp';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import cheerio from 'gulp-cheerio';

const srcFolder = './src/my-images/';
const minifiedFolder = './src/my-images/minified/';
const yamlFile = './src/my-images/image-data.yaml';
const htmlFiles = 'src/**/*.html';

function initImageMinifier(gulp) {
	function resetFolder(folder) {
		console.log(`Resetting folder: ${folder}`);
		if (fs.existsSync(folder)) {
			console.log(`Folder exists: ${folder}`);
			fs.rmSync(folder, { recursive: true, force: true });
		}
		console.log(`Creating folder: ${folder}`);
		try {
			fs.mkdirSync(folder, { recursive: true });
			console.log(`Folder ${folder} has been created.`);
		} catch (error) {
			console.error(`Error creating folder ${folder}:`, error);
		}
	}

	function minifyImages() {
		resetFolder(minifiedFolder);

		return gulp
			.src(`${srcFolder}**/*.{jpg,jpeg,png,webp,gif}`)
			.pipe(
				imagemin({
					optimizationLevel: 5,
					progressive: true, // Для JPG
					interlaced: true, // Для GIF
					multipass: true, // Для SVG
				})
			)
			.on('data', async (file) => {
				const filePath = file.path;
				const fileName = path.basename(filePath);
				const outputFilePath = path.join(minifiedFolder, fileName);

				try {
					const image = sharp(filePath);
					const metadata = await image.metadata();

					const width = Math.round(metadata.width / 10);
					const height = Math.round(metadata.height / 10);

					await image.resize(width, height).toFile(outputFilePath);

					// Сохранение данных о соотношении сторон
					// const aspectRatio = (metadata.width / metadata.height).toFixed(2);
					const aspectRatio = `${metadata.width} / ${metadata.height}`;
					const imageData = { [fileName]: aspectRatio };

					// Добавление данных в YAML
					let yamlData = {};
					if (fs.existsSync(yamlFile)) {
						yamlData = yaml.load(fs.readFileSync(yamlFile, 'utf8')) || {};
					}
					yamlData = { ...yamlData, ...imageData };

					fs.writeFileSync(yamlFile, yaml.dump(yamlData));
				} catch (error) {
					console.error(`Ошибка обработки изображения ${fileName}:`, error);
				}
			});
	}

	function setMinifiedImages() {
		let yamlData = {};
		if (fs.existsSync(yamlFile)) {
			yamlData = yaml.load(fs.readFileSync(yamlFile, 'utf8')) || {};
		}

		return gulp
			.src(htmlFiles)
			.pipe(
				cheerio({
					run: ($) => {
						$('div.blur-load').each(function () {
							const imgTag = $(this).find('img');
							const srcAttr = imgTag.attr('src');

							if (srcAttr) {
								const fileName = path.basename(srcAttr);
								const aspectRatio = yamlData[fileName];

								if (aspectRatio) {
									$(this).attr('style', `background-image: url('./my-images/minified/${fileName}'); aspect-ratio: ${aspectRatio}`);
								}
							}
						});
					},
					parserOptions: { xmlMode: false },
				})
			)
			.pipe(gulp.dest((file) => file.base));
	}

	// gulp.series(minifyImages);
	gulp.task('minify-images', minifyImages);
	gulp.task('set-minified', setMinifiedImages);
}

export default initImageMinifier;
