document.getElementById('baniFile').addEventListener('change', handleBaniUpload);
document.getElementById('download').addEventListener('click', downloadBaniFile);

let baniData = [];
let filenames = [];

function handleBaniUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = parseJSON(e.target.result);
                    validateBaniFile(data);
                    baniData.push(data);
                    filenames.push(file.name);
                } catch (error) {
                    console.error('Error parsing BANI file:', error);
                    alert('Error parsing BANI file: ' + error.message);
                }
            };
            reader.readAsText(file);
        });
    }
}

function parseJSON(jsonString) {
    return JSON.parse(jsonString.replace(/,\s*([\]}])/g, '$1'));
}

function validateBaniFile(data) {
    const requiredProps = ['name', 'modificatedDate', 'filetype', 'options', 'sprites', 'defaults'];
    const requiredOptionsProps = ['looping', 'continuous', 'blockingbounds', 'center'];
    const requiredDefaultsProps = ['BODY', 'HEAD', 'HAT'];

    checkProperties(data, requiredProps);
    checkProperties(data.options, requiredOptionsProps, 'options.');
    checkProperties(data.defaults, requiredDefaultsProps, 'defaults.');

    if (!Array.isArray(data.options.blockingbounds) || data.options.blockingbounds.length !== 4) {
        throw new Error('Invalid blockingbounds format. Expected an array of 4 elements.');
    }

    if (!data.sprites || typeof data.sprites !== 'object') {
        throw new Error('Missing or invalid sprites property.');
    }
}

function checkProperties(obj, properties, prefix = '') {
    properties.forEach(prop => {
        if (!obj.hasOwnProperty(prop)) {
            throw new Error(`Missing property '${prefix}${prop}' in the BANI file`);
        }
    });
}

function downloadBaniFile() {
    if (baniData.length === 0) {
        alert('No BANI files loaded.');
        return;
    }

    const zip = new JSZip();

    baniData.forEach((data, index) => {
        if (!data.defaults.MASK) {
            data.defaults.MASK = 'bbuilder_enueanbumask.png';
        }

        data.online = 2; // Get the Etherion Server Files

        const sprites = createMaskSprites(data);

        updateFramesWithMasks(data, sprites);

        const baniBlob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        zip.file(filenames[index].replace('.bani', '_updated.bani'), baniBlob);
    });

    zip.generateAsync({ type: 'blob' }).then(function (content) {
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(content);
        downloadLink.download = 'bani_files.zip';
        downloadLink.click();
    });
}

function createMaskSprites(data) {
    const directions = [
        { name: 'down', bounds: [0, 0, 48, 72] },
        { name: 'up', bounds: [48, 0, 48, 72] },
        { name: 'right', bounds: [96, 0, 48, 72] },
        { name: 'left', bounds: [96, 0, 48, 72], scale: [-1, 1] }
    ];

    const sprites = {};

    directions.forEach(({ name, bounds, scale }, index) => {
        const key = (Object.keys(data.sprites).length + index).toString();
        data.sprites[key] = {
            gfx: 'MASK',
            bounds,
            ...(scale && { scale })
        };
        sprites[name] = key;
    });

    return sprites;
}

function updateFramesWithMasks(data, sprites) {
    let headCoords = [];

    data.frames.forEach((frame) => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        [down, up, left, right].forEach((direction, directionIndex) => {
            direction.forEach((spriteData) => {
                const [spriteId, spriteX, spriteY] = spriteData;

                const sprite = data.sprites[spriteId];
                if (sprite?.gfx === "HEAD" && sprite.bounds && sprite.bounds[2] === 48 && sprite.bounds[3] === 48) {
                    const headX = spriteX;
                    const headY = spriteY;

                    let maskX = headX;
                    let maskY = headY;

                    if (directionIndex === 0) { // DOWN
                        maskY = headY - 16;
                    } else if (directionIndex === 1) { // UP
                        maskY = headY - 10;
                    } else if (directionIndex === 2) { // LEFT
                        maskX = headX - 1;
                        maskY = headY - 15;
                    } else if (directionIndex === 3) { // RIGHT
                        maskX = headX + 1;
                        maskY = headY - 15;
                    }

                    let existingCoord = headCoords.find(coord => coord.maskX === maskX && coord.maskY === maskY && coord.frame === frame);

                    if (!existingCoord) {
                        headCoords.push({ id: spriteId, maskX, maskY, direction: directionIndex, frame });
                    }
                }
            });
        });
    });

    if (headCoords.length === 0) {
        alert("No HEAD sprites with bounds 48x48 found.");
        return;
    }

    data.frames.forEach((frame) => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        headCoords.forEach(({ maskX, maskY, direction, frame: maskFrame }) => {
            if (maskFrame === frame) {
                if (direction === 0 && !down.some(item => item[1] === maskX && item[2] === maskY)) {
                    down.push([sprites.down, maskX, maskY]);
                } else if (direction === 1 && !up.some(item => item[1] === maskX && item[2] === maskY)) {
                    up.push([sprites.up, maskX, maskY]);
                } else if (direction === 2 && !left.some(item => item[1] === maskX && item[2] === maskY)) {
                    left.push([sprites.left, maskX, maskY]);
                } else if (direction === 3 && !right.some(item => item[1] === maskX && item[2] === maskY)) {
                    right.push([sprites.right, maskX, maskY]);
                }
            }
        });
    });
}
