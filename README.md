# StitchGrid - Pattern Maker

StitchGrid is a browser-based tool that converts images into editable cross-stitch (or pixel art) grids. It runs entirely in the browser using HTML5 Canvas and vanilla JavaScript, with no backend required.

# Features

Image to Grid Conversion: Upload any image and automatically pixelate it to your desired dimensions.

Color Quantization: Uses K-Means clustering to reduce the image to a specific palette size (e.g., 2 to 32 colors).

Pattern Editing: Built-in pencil and eraser tools to refine the generated pattern.

Smart Tools: Batch color replacement and contrast adjustment.

Print-Ready Export: Export the full pattern as an image, or automatically slice it into 100x100 blocks for printing on standard paper.

Rulers & Axes: Displays column/row counts and physical dimensions (cm) based on configurable stitch density.

# Usage

This project is a single-file application.

Download index.html.

Open it in any modern web browser (Chrome, Firefox, Edge, Safari).

Upload an image to start creating.

# Dependencies

This project uses the following open-source libraries:

Tailwind CSS: Used for styling via CDN. (MIT License)

Icons: Inline SVG icons based on Lucide / Feather icons. (ISC/MIT License)

# License

This project is licensed under the MIT License - see the LICENSE file for details.